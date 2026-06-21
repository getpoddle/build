import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data containing the audio file
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || typeof audioFile === "string") {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client sends browser locale (e.g. "en", "fr", "de") as a Whisper language hint
    const langHint = formData.get("language");
    const language = typeof langHint === "string" && langHint.trim().length >= 2
      ? langHint.trim().toLowerCase().slice(0, 8)
      : null;

    // Derive filename from the uploaded file's actual type so Whisper parses it correctly
    const mimeType = (audioFile as File).type || "audio/wav";
    const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "wav";
    const filename = `recording.${ext}`;

    // Forward to Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, filename);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "text");
    if (language) {
      whisperForm.append("language", language);
    }

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      return new Response(JSON.stringify({ error: "Transcription failed", detail: err }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawTranscript = (await whisperRes.text()).trim();

    if (!rawTranscript) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up verbal fillers and restructure for strategic clarity
    const cleanRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a transcription editor. Your job is to clean up a voice recording transcript without changing the meaning.

Rules:
- Remove verbal fillers: "um", "uh", "er", "like", "you know", "kind of", "sort of", "basically", "literally", "I mean", "right", "okay so"
- Remove false starts and repeated phrases (e.g. "I think — I think we should" → "I think we should")
- Fix obvious speech-to-text errors based on context
- Keep the speaker's authentic voice, vocabulary, and intent
- Do NOT summarize, shorten, or reinterpret — preserve all their ideas and strategic variables
- Output only the cleaned transcript text with no commentary, labels, or preamble`,
          },
          {
            role: "user",
            content: rawTranscript,
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    const cleanData = await cleanRes.json();
    const cleanedText = cleanData.choices?.[0]?.message?.content?.trim() || rawTranscript;

    return new Response(JSON.stringify({ text: cleanedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
