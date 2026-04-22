// Edge function: extract PDF text + call Lovable AI to refine resume into ATS structured JSON
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
// pdf parsing in Deno
// @ts-ignore
import * as pdfjs from "npm:pdfjs-serverless@0.5.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

function buildSystemPrompt(forceOnePage: boolean) {
  return `You are a Senior Technical Recruiter and Global ATS Optimization Expert. 
Your goal is to re-engineer the provided resume to achieve a 95%+ match score for the target Job Description.

CORE STRATEGIES:
1. SEMANTIC MIRRORING: Identify the exact technical verbs, nouns, and toolsets in the JD. Mirror them EXACTLY. If the JD says "Continuous Integration/Continuous Deployment", do not use "CI/CD".
2. STAR/XYZ QUANTIFICATION: Every bullet point MUST follow the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Use metrics, percentages, dollar amounts, and timeframes.
3. REMOVE FLUFF: Delete subjective adjectives (passionate, dedicated, detail-oriented). Replace with hard evidence of impact.
4. ATS STRUCTURE: Ensure sections follow standard naming (Summary, Skills, Experience, Education). Use single-column, plain-text compatible structure.
5. DOMAIN AGNOSTIC: Whether it's Software, VLSI, Finance, or Nursing, identify the core KPIs and technical stack from the JD and prioritize them.

LENGTH LOGIC:
${forceOnePage 
  ? "- FORCED 1-PAGE: Be ruthless. Prioritize only the most relevant 3-4 roles. Limit bullets to 3 per role. Word count target: 450-600 words."
  : "- DYNAMIC LENGTH: Target 1 page (500-650 words) unless the candidate has 10+ years of highly relevant experience or the JD is extremely senior/complex, in which case 2 pages is acceptable."}

Return the optimized resume data via the 'emit_resume' tool call.`;
}

const tool = {
  function_declarations: [{
    name: "emit_resume",
    description: "Emit ATS-optimized resume JSON data",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        contact: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING" },
            phone: { type: "STRING" },
            location: { type: "STRING" },
            linkedin: { type: "STRING" },
            website: { type: "STRING" },
          },
        },
        summary: { type: "STRING", description: "3-4 line high-impact ATS summary" },
        skills: {
          type: "ARRAY",
          description: "Flat list of technical and soft skills mirroring JD keywords",
          items: { type: "STRING" },
        },
        experience: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              company: { type: "STRING" },
              location: { type: "STRING" },
              dates: { type: "STRING" },
              bullets: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "STAR/XYZ formatted bullets",
              },
            },
            required: ["title", "company", "dates", "bullets"],
          },
        },
        education: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              degree: { type: "STRING" },
              school: { type: "STRING" },
              dates: { type: "STRING" },
              details: { type: "STRING" },
            },
            required: ["degree", "school"],
          },
        },
        projects: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              bullets: { type: "ARRAY", items: { type: "STRING" } },
            },
          },
        },
        certifications: { type: "ARRAY", items: { type: "STRING" } },
        company_name: { type: "STRING", description: "Target company name from JD" },
        page_target: { type: "NUMBER", description: "Recommended page length (1 or 2)" },
        length_decision_reason: { type: "STRING" },
        match_score_before: { type: "NUMBER", description: "Estimate of original match score (0-100)" },
        match_score_after: { type: "NUMBER", description: "Estimate of optimized match score (0-100)" },
        keywords_added: { type: "ARRAY", items: { type: "STRING" } },
        keywords_missing_in_original: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["name", "summary", "skills", "experience", "education", "match_score_before", "match_score_after"],
    },
  }],
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Extract ALL text verbatim from this resume PDF. Preserve sections, bullets, dates, companies, contact info. Return only the raw extracted text." },
          { inline_data: { mime_type: "application/pdf", data: b64 } }
        ]
      }]
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini Vision extract failed", res.status, t);
    throw new Error("Vision extract failed");
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const form = await req.formData();
    const jd = String(form.get("jd") || "").trim();
    const forceOnePage = String(form.get("force_one_page") || "false") === "true";
    const file = form.get("resume") as File | null;
    
    if (!jd) return json({ error: "Job description required" }, 400);
    if (!file) return json({ error: "Resume PDF required" }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    let resumeText = await extractPdfText(buf);

    const looksGood = resumeText.trim().length >= 200 && (resumeText.match(/[a-zA-Z]/g) || []).length >= 100;
    if (!looksGood) {
      console.log("Native extract weak, falling back to Gemini Vision OCR");
      try {
        resumeText = await extractWithVision(buf);
      } catch {
        return json({ error: "Could not read PDF (text extraction and OCR both failed)." }, 400);
      }
    }
    
    if (resumeText.trim().length < 50) {
      return json({ error: "Resume text too short or unreadable." }, 400);
    }

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `SYSTEM INSTRUCTIONS:\n${buildSystemPrompt(forceOnePage)}\n\nJOB DESCRIPTION:\n${jd}\n\n---\nORIGINAL RESUME TEXT:\n${resumeText}` }] }
        ],
        tools: [{ function_declarations: tool.function_declarations }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["emit_resume"] } }
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Gemini error", aiRes.status, t);
      return json({ error: "Gemini AI error" }, 500);
    }

    const data = await aiRes.json();
    const call = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
    
    if (!call) {
      // Fallback if it didn't call the function properly (rare with mode: ANY)
      console.error("Gemini returned no tool call", JSON.stringify(data));
      return json({ error: "AI returned no structured output" }, 500);
    }

    return json({ resume: call.args });
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

