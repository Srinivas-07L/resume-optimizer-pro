// Edge function: extract text from uploaded cover letter PDF + return
// targeted find/replace swaps that tailor it to a new JD while preserving
// the original layout, fonts, and margins. The frontend applies the swaps
// directly on the original PDF using pdf-lib.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
// @ts-ignore
import * as pdfjs from "npm:pdfjs-serverless@0.5.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `You are an elite career coach performing IN-PLACE editing of a cover letter PDF.

YOU DO NOT REWRITE THE LETTER. You return a small list of EXACT find/replace edits that swap only:
- The company name (every occurrence)
- The date (if outdated)
- 2-5 short "tailoring" sentences or phrases that mention the OLD company, OLD role, or generic claims that should mirror keywords from the NEW JD.

HARD RULES:
- "find" MUST be an EXACT substring of the original letter text (verbatim, including punctuation and case). If it's not exact, the swap will fail.
- "replace" MUST have approximately the same character length (±15%) as "find" so the layout/wrapping stays identical.
- Never invent metrics, employers, or experiences not present in the original.
- Mirror EXACT keywords from the JD where applicable.
- Preserve the user's voice, tone, and sentence rhythm.
- Return 3-8 edits MAX. Quality over quantity.
- ATS-friendly plain text only.`;

const tool = {
  type: "function",
  function: {
    name: "emit_edits",
    description: "Emit targeted in-place edits for the cover letter PDF",
    parameters: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Target company from JD; empty if unknown" },
        edits: {
          type: "array",
          description: "Find/replace pairs. 'find' must be verbatim from the original.",
          items: {
            type: "object",
            properties: {
              find: { type: "string", description: "Exact substring from the original letter" },
              replace: { type: "string", description: "Replacement, similar length to find" },
              reason: { type: "string", description: "Short justification" },
            },
            required: ["find", "replace"],
          },
        },
        keywords_added: { type: "array", items: { type: "string" } },
      },
      required: ["edits"],
      additionalProperties: false,
    },
  },
};

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const doc = await (pdfjs as any).getDocument({ data: bytes, useSystemFonts: true }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text;
  } catch (e) {
    console.error("pdfjs extract failed", e);
    return "";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function extractWithVision(bytes: Uint8Array): Promise<string> {
  const b64 = bytesToBase64(bytes);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ALL text verbatim from this cover letter PDF. Preserve punctuation and casing exactly. Return only the raw text." },
            { type: "file", file: { filename: "letter.pdf", file_data: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("Vision extract failed");
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const form = await req.formData();
    const jd = String(form.get("jd") || "").trim();
    const file = form.get("letter") as File | null;
    if (!jd || jd.length < 50) return json({ error: "Target JD required (min 50 chars)" }, 400);
    if (!file) return json({ error: "Cover letter PDF required" }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    let letterText = await extractPdfText(buf);
    const looksGood =
      letterText.trim().length >= 100 && (letterText.match(/[a-zA-Z]/g) || []).length >= 60;
    if (!looksGood) {
      try {
        letterText = await extractWithVision(buf);
      } catch {
        return json({ error: "Could not read cover letter PDF." }, 400);
      }
    }
    if (letterText.trim().length < 50) return json({ error: "Letter text too short or unreadable." }, 400);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `TARGET JOB DESCRIPTION:\n${jd}\n\n---\nORIGINAL COVER LETTER TEXT (verbatim — your "find" strings MUST be exact substrings of this):\n${letterText}`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_edits" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limit exceeded. Please retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "AI returned no structured output" }, 500);
    const parsed = JSON.parse(call.function.arguments);

    // Filter edits to only those that actually exist verbatim in the letter
    const validEdits = (parsed.edits || []).filter((e: any) =>
      typeof e?.find === "string" && e.find.length > 0 && letterText.includes(e.find),
    );

    return json({
      original_text: letterText,
      company_name: parsed.company_name || "",
      edits: validEdits,
      keywords_added: parsed.keywords_added || [],
    });
  } catch (e) {
    console.error("refine-cover-letter error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
