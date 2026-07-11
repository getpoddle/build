import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import mammoth from "npm:mammoth";
import * as XLSX from "npm:xlsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EXTRACT_CHARS = 40_000;

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("Content-Type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse form data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing file field" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File exceeds 10 MB limit" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let mimeType = file.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (lower.endsWith(".xlsx")) mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (lower.endsWith(".xls")) mimeType = "application/vnd.ms-excel";
    }

    if (!ACCEPTED_TYPES.has(mimeType)) {
      return new Response(JSON.stringify({
        error: "Unsupported file type. Please upload a PDF (.pdf), Word document (.docx), or Excel spreadsheet (.xls, .xlsx).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const arrayBuffer = await file.arrayBuffer();
    let extractedText = "";

    const isExcel = mimeType === "application/vnd.ms-excel" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (mimeType === "application/pdf") {
      extractedText = await extractPdf(new Uint8Array(arrayBuffer));
    } else if (isExcel) {
      extractedText = extractXlsx(arrayBuffer);
    } else {
      extractedText = await extractDocx(arrayBuffer);
    }

    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, MAX_EXTRACT_CHARS);

    if (extractedText.length < 50) {
      return new Response(JSON.stringify({
        error: "We couldn't read any text from this file. Try saving it as PDF from Word, or ensure the document is not password-protected.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      filename: file.name,
      extractedText,
      charCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("extract-document error:", err);
    return new Response(JSON.stringify({
      error: "We couldn't read this file — try saving as PDF from Word, or check the file is not corrupted.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── DOCX extraction ─────────────────────────────────────────────────────────

async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

// ─── Excel extraction ────────────────────────────────────────────────────────
// Converts each sheet to a tab-separated text block so agents can reason about
// tabular data without needing to parse a binary format.

function extractXlsx(arrayBuffer: ArrayBuffer): string {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim().length > 0) {
      parts.push(`[Sheet: ${sheetName}]\n${csv}`);
    }
  }
  return parts.join("\n\n");
}

// ─── PDF extraction ───────────────────────────────────────────────────────────
// Parses PDF at the binary level — finds content streams, decompresses
// FlateDecode streams (trying both zlib and raw-deflate), then extracts
// text from PDF text operators (Tj / TJ). Handles the vast majority of
// real-world PDFs produced by Word, macOS, Adobe, and common exporters.

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const texts: string[] = [];

  // Byte sequences to search for
  const STREAM    = strToBytes("stream");
  const ENDSTREAM = strToBytes("endstream");

  let pos = 0;
  while (pos < bytes.length - 10) {
    // Find next 'stream' keyword
    const streamKw = findSeq(bytes, STREAM, pos);
    if (streamKw === -1) break;

    // The byte immediately after 'stream' must be LF or CR+LF
    let dataStart = streamKw + STREAM.length;
    if (bytes[dataStart] === 0x0D && bytes[dataStart + 1] === 0x0A) {
      dataStart += 2;
    } else if (bytes[dataStart] === 0x0A) {
      dataStart += 1;
    } else {
      pos = streamKw + 1;
      continue;
    }

    // Find matching endstream
    const endKw = findSeq(bytes, ENDSTREAM, dataStart);
    if (endKw === -1) break;

    // Strip trailing CR/LF before endstream
    let dataEnd = endKw;
    if (dataEnd > 0 && bytes[dataEnd - 1] === 0x0A) dataEnd--;
    if (dataEnd > 0 && bytes[dataEnd - 1] === 0x0D) dataEnd--;

    // Look at the dictionary before this stream to determine filter
    const dictWindow = bytes.slice(Math.max(0, streamKw - 400), streamKw);
    const dictStr = new TextDecoder("latin1").decode(dictWindow);

    // Skip image streams — they won't contain text operators
    const isImage = /\/Subtype\s*\/Image/.test(dictStr);
    if (!isImage && dataEnd > dataStart) {
      const streamData = bytes.slice(dataStart, dataEnd);
      const isFlateDecode = /\/FlateDecode/.test(dictStr) || /\/Fl(?:\s|\/|>>)/.test(dictStr);

      if (isFlateDecode) {
        try {
          const raw = await tryDecompress(streamData);
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(raw);
          const t = extractTextOps(decoded);
          if (t.trim().length > 0) texts.push(t);
        } catch {
          // Decompression failed — stream is not a text content stream
        }
      } else {
        // Uncompressed — decode directly and look for text operators
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(streamData);
        const t = extractTextOps(decoded);
        if (t.trim().length > 0) texts.push(t);
      }
    }

    pos = endKw + ENDSTREAM.length;
  }

  // Fallback: scan the whole file as latin1 for uncompressed text ops
  if (texts.length === 0) {
    const full = new TextDecoder("latin1").decode(bytes);
    const t = extractTextOps(full);
    if (t.trim().length > 0) texts.push(t);
  }

  return texts.join("\n");
}

// Try zlib first, then raw deflate — PDF FlateDecode is usually zlib,
// but some generators omit the header and use raw deflate.
async function tryDecompress(data: Uint8Array): Promise<Uint8Array> {
  try {
    return await decompress(data, "deflate");
  } catch {
    return await decompress(data, "deflate-raw");
  }
}

async function decompress(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// Extract text from PDF content stream using Tj / TJ operators.
// Handles both literal strings (text) and hex strings <HHHH>, which modern
// PDFs from Word, Google Docs, and Adobe use for CIDFont/Type0 fonts.
function extractTextOps(content: string): string {
  const parts: string[] = [];
  let m: RegExpExecArray | null;

  // (text) Tj — literal string
  const tjLitRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  while ((m = tjLitRe.exec(content)) !== null) {
    const s = decodePdfStr(m[1]);
    if (s.trim()) parts.push(s);
  }

  // <hex> Tj — hex-encoded string (CIDFont / Type0 PDFs)
  const tjHexRe = /<([0-9a-fA-F\s]+)>\s*Tj/g;
  while ((m = tjHexRe.exec(content)) !== null) {
    const s = decodeHexPdfStr(m[1]);
    if (s.trim()) parts.push(s);
  }

  // [...] TJ — array form; elements can be either (literal) or <hex> strings
  const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
  while ((m = tjArrRe.exec(content)) !== null) {
    const inner = m[1];
    const seg: string[] = [];
    const tokenRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9a-fA-F\s]+)>/g;
    let tok: RegExpExecArray | null;
    while ((tok = tokenRe.exec(inner)) !== null) {
      if (tok[1] !== undefined) {
        const t = decodePdfStr(tok[1]);
        if (t.trim()) seg.push(t);
      } else if (tok[2] !== undefined) {
        const t = decodeHexPdfStr(tok[2]);
        if (t.trim()) seg.push(t);
      }
    }
    if (seg.length > 0) parts.push(seg.join(""));
  }

  return parts.join(" ");
}

function decodePdfStr(raw: string): string {
  return raw
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      const c = parseInt(oct, 8);
      return c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
    })
    .replace(/\\\\/g, "\\").replace(/\\\)/g, ")").replace(/\\\(/g, "(");
}

// Decode a PDF hex string. Modern PDFs (Word, Google Docs, Adobe) encode
// text as UTF-16 BE pairs — e.g. <00480065> → "He". Falls back to latin-1.
function decodeHexPdfStr(hex: string): string {
  hex = hex.replace(/\s/g, "");
  if (!hex) return "";
  if (hex.length % 2 !== 0) hex += "0";

  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  // Detect UTF-16 BE: if more than half the "high" bytes (even indices) are
  // 0x00, the content is almost certainly UTF-16 encoded ASCII/Latin text.
  if (bytes.length >= 2 && bytes.length % 2 === 0) {
    const highZero = bytes.filter((_, i) => i % 2 === 0 && bytes[i] === 0).length;
    if (highZero > bytes.length / 4) {
      try {
        const text = new TextDecoder("utf-16be").decode(new Uint8Array(bytes));
        const clean = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ").trim();
        if (clean.length > 0) return clean;
      } catch {
        // fall through to latin-1
      }
    }
  }

  // Latin-1 fallback
  return bytes
    .map(b => (b >= 32 && b !== 127) ? String.fromCharCode(b) : " ")
    .join("");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function findSeq(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
