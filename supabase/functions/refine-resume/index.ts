// Edge function: extract PDF text + call Lovable AI to refine resume into ATS structured JSON
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
// pdf parsing in Deno
// @ts-ignore
import * as pdfjs from "npm:pdfjs-serverless@0.5.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

function buildSystemPrompt(forceOnePage: boolean) {
  return `You are a Senior Technical Recruiter and ATS optimization expert. Rewrite the user's resume to score 95%+ on ATS systems for the provided Job Description.

HARD RULES:
- Domain agnostic (VLSI, Full Stack, Mechanical, Finance, etc.). Identify exact technical verbs and nouns in the JD.
- KEYWORD MIRRORING: Use the EXACT strings from the JD. If JD says "Object-Oriented Programming", never write "OOP". Mirror tools, frameworks, languages exactly as written.
- Google XYZ / STAR formula for EVERY bullet: "Accomplished [X] as measured by [Y], by doing [Z]." Quantify with numbers/percentages/timeframes.
- 95% RULE: Remove ALL fluff ("passionate", "team player", "hardworking", "detail-oriented"). Only hard skills and quantified metrics.
- Standard sections only: Summary, Skills, Experience, Education (and Projects/Certifications if present in source).
- Single column, plain text. NO tables, NO icons, NO columns.
- Preserve truth: do not invent employers, dates, or degrees. You may rephrase and quantify reasonably from context.

SMART LENGTH LOGIC:
${forceOnePage
  ? `- USER FORCED 1-PAGE MODE. Be RUTHLESS. Target ~480-580 words TOTAL. Drop oldest/least-relevant jobs entirely. Keep 3-4 bullets per recent role, 2 for older. Trim summary to 2-3 lines. Set page_target = 1.`
  : `- DEFAULT TO 1 PAGE. Target ~480-580 words. Be ruthless: cut older/less-relevant experience to keep strongest content on page one.
- ONLY expand to 2 pages (~900-1100 words) if the JD explicitly requires 3+ years experience OR has extreme volume of complex technical requirements that cannot be summarized without dropping below a 90% match. Set page_target accordingly (1 or 2).`}
- Set the "page_target" field to 1 or 2 based on this logic. Set "length_decision_reason" with a one-line justification.

Return STRICT JSON via the tool call only.`;
}

const tool = {
  type: "function",
  function: {
    name: "emit_resume",
    description: "Emit ATS-optimized resume + match scores",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        contact: {
          type: "object",
          properties: {
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            linkedin: { type: "string" },
            website: { type: "string" },
          },
        },
        summary: { type: "string", description: "3-4 line ATS summary mirroring JD keywords" },
        skills: {
          type: "array",
          description: "Flat list of skills using EXACT JD strings where applicable",
          items: { type: "string" },
        },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              location: { type: "string" },
              dates: { type: "string" },
              bullets: {
                type: "array",
                items: { type: "string" },
                description: "STAR/XYZ bullets, each quantified",
              },
            },
            required: ["title", "company", "dates", "bullets"],
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              degree: { type: "string" },
              school: { type: "string" },
              dates: { type: "string" },
              details: { type: "string" },
            },
            required: ["degree", "school"],
          },
        },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
        },
        certifications: { type: "array", items: { type: "string" } },
        company_name: { type: "string", description: "Best guess of target company name from JD; empty if unknown" },
        match_score_before: { type: "number", description: "0-100 ATS match of ORIGINAL resume vs JD" },
        match_score_after: { type: "number", description: "0-100 ATS match of REWRITTEN resume vs JD (target 95+)" },
        keywords_added: { type: "array", items: { type: "string" } },
        keywords_missing_in_original: { type: "array", items: { type: "string" } },
      },
      required: [
        "name",
        "summary",
        "skills",
        "experience",
        "education",
        "match_score_before",
        "match_score_after",
      ],
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
            { type: "text", text: "Extract ALL text verbatim from this resume PDF. Preserve sections, bullets, dates, companies, contact info. Return only the raw extracted text." },
            { type: "file", file: { filename: "resume.pdf", file_data: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Vision extract failed", res.status, t);
    throw new Error("Vision extract failed");
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const form = await req.formData();
    const jd = String(form.get("jd") || "").trim();
    const file = form.get("resume") as File | null;
    if (!jd) return json({ error: "Job description required" }, 400);
    if (!file) return json({ error: "Resume PDF required" }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    let resumeText = await extractPdfText(buf);

    const looksGood = resumeText.trim().length >= 200 && (resumeText.match(/[a-zA-Z]/g) || []).length >= 100;
    if (!looksGood) {
      console.log("Native extract weak, falling back to vision OCR");
      try {
        resumeText = await extractWithVision(buf);
      } catch {
        return json({ error: "Could not read PDF (text extraction and OCR both failed)." }, 400);
      }
    }
    if (resumeText.trim().length < 50) {
      return json({ error: "Resume text too short or unreadable." }, 400);
    }

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
            content: `JOB DESCRIPTION:\n${jd}\n\n---\nORIGINAL RESUME TEXT:\n${resumeText}`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_resume" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429)
        return json({ error: "Rate limit exceeded. Please retry in a moment." }, 429);
      if (aiRes.status === 402)
        return json({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "AI returned no structured output" }, 500);
    const parsed = JSON.parse(call.function.arguments);

    return json({ resume: parsed });
  } catch (e) {
    console.error("refine-resume error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
