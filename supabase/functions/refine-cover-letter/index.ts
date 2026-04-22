// Edge function: tailor a base cover letter to a target JD, preserving voice & format
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `You are an elite career coach rewriting a cover letter to fit a Target Job Description.

HARD RULES:
- FORMAT LOCKING: Preserve the user's exact paragraph count, structure, salutation style, sign-off, and overall length (±10% words).
- VOICE LOCKING: Keep the user's tone, sentence rhythm, idioms, and personal phrases. Do NOT inject generic "passionate / dynamic / synergy" filler.
- KEYWORD MIRRORING: Swap weak/generic phrases with EXACT keywords, tools, and responsibilities from the JD (verbatim spelling).
- NO FABRICATION: Do not invent employers, metrics, or experiences not present in the base letter.
- ATS-friendly plain text. No markdown, no bullets unless original used them, no tables.
- Output via the tool call only.`;

const tool = {
  type: "function",
  function: {
    name: "emit_cover_letter",
    description: "Emit tailored cover letter",
    parameters: {
      type: "object",
      properties: {
        applicant_name: { type: "string", description: "Best guess from base letter sign-off; empty if unknown" },
        company_name: { type: "string", description: "Target company from JD; empty if unknown" },
        date: { type: "string", description: "Today or original date" },
        recipient_block: { type: "string", description: "Hiring manager / company address block, may be empty" },
        salutation: { type: "string", description: "e.g., 'Dear Hiring Manager,'" },
        paragraphs: {
          type: "array",
          items: { type: "string" },
          description: "Body paragraphs in order, plain text, blank lines between paragraphs in PDF",
        },
        sign_off: { type: "string", description: "e.g., 'Sincerely,'" },
        signature_name: { type: "string" },
        keywords_added: { type: "array", items: { type: "string" } },
      },
      required: ["paragraphs", "salutation", "sign_off"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { base_letter, jd } = await req.json();
    if (!base_letter || String(base_letter).trim().length < 50)
      return json({ error: "Base cover letter required (min 50 chars)" }, 400);
    if (!jd || String(jd).trim().length < 50)
      return json({ error: "Target JD required (min 50 chars)" }, 400);

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
            content: `TARGET JOB DESCRIPTION:\n${jd}\n\n---\nBASE COVER LETTER (preserve format & voice exactly):\n${base_letter}`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_cover_letter" } },
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
    return json({ letter: parsed });
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
