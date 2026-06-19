import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import mammoth from "npm:mammoth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EXTRACT_CHARS = 40_000; // ~10k tokens — leaves room for agent prompts + response

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

    // Determine MIME type from header or filename
    let mimeType = file.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    if (!ACCEPTED_TYPES.has(mimeType)) {
      return new Response(JSON.stringify({
        error: "Unsupported file type. Please upload a PDF (.pdf) or Word document (.docx).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const arrayBuffer = await file.arrayBuffer();
    let extractedText = "";

    if (mimeType === "application/pdf") {
      extractedText = await extractPdf(new Uint8Array(arrayBuffer));
    } else {
      extractedText = await extractDocx(arrayBuffer);
    }

    // Normalise whitespace
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

// ─── DOCX extraction via mammoth ──────────────────────────────────────────────

async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

// ─── PDF extraction ───────────────────────────────────────────────────────────
// Parses PDF text operators (BT/ET blocks, Tj, TJ) and FlateDecode streams.
// Handles the majority of real-world PDFs without external dependencies.

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];

  // 1. Try FlateDecode streams (modern PDFs compress text streams with zlib)
  const streamRegex = /<<[^>]*\/FlateDecode[^>]*>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = streamRegex.exec(latin1)) !== null) {
    const rawStream = encodeLatin1ToBytes(m[1]);
    try {
      const decompressed = await decompressDeflate(rawStream);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
      const extracted = extractTextFromPdfOps(text);
      if (extracted) parts.push(extracted);
    } catch {
      // Non-text stream — skip
    }
  }

  // 2. Uncompressed text streams (older PDFs or inline streams)
  const btText = extractTextFromPdfOps(latin1);
  if (btText) parts.push(btText);

  return parts.join("\n");
}

function extractTextFromPdfOps(content: string): string {
  const lines: string[] = [];

  // Tj: (text) Tj
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(content)) !== null) {
    const decoded = decodePdfLiteral(m[1]);
    if (decoded.trim().length > 0) lines.push(decoded);
  }

  // TJ: [(text) num (text)] TJ
  const tjArrayRe = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjArrayRe.exec(content)) !== null) {
    const parts: string[] = [];
    const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = strRe.exec(m[1])) !== null) {
      const decoded = decodePdfLiteral(s[1]);
      if (decoded.trim()) parts.push(decoded);
    }
    if (parts.length > 0) lines.push(parts.join(""));
  }

  return lines.join(" ");
}

function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      const code = parseInt(oct, 8);
      return code > 31 && code < 128 ? String.fromCharCode(code) : " ";
    })
    .replace(/\\\\/g, "\\")
    .replace(/\\\)/g, ")")
    .replace(/\\\(/g, "(");
}

function encodeLatin1ToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

async function decompressDeflate(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const blob = new Blob([compressed]);
  const decompressed = blob.stream().pipeThrough(ds);
  const response = new Response(decompressed);
  const buf = await response.arrayBuffer();
  return new Uint8Array(buf);
}
