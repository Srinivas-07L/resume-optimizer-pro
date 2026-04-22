const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

function buildSystemPrompt(forceOnePage: boolean) {
  return `You are a Senior Technical Recruiter and ATS Optimization Expert.
Your goal is to re-engineer the provided resume to be a high-fidelity match for the Job Description.

CORE STRATEGY:
1. QUANTIFY EVERYTHING: Use the Google XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]". Every bullet must have a metric (%, $, time, or scale).
2. SEMANTIC KEYWORD MIRRORING: Identify the most important technical keywords in the JD and mirror them exactly in the resume, but only where truthful.
3. SENIORITY ALIGNMENT: Ensure the tone and highlights match the seniority level requested.
4. SMART LENGTH: ${forceOnePage ? "STRICTLY keep the output concise enough for a 1-page layout." : "If the person has >8 years of experience, a 2-page target is acceptable; otherwise, target 1 page."}

FORMATTING RULES:
- Return ONLY a valid JSON object matching the requested schema.
- Do not include any preamble or markdown formatting.
- Ensure the 'summary' is punchy and keyword-dense.
- Skills should be grouped logically (e.g., Languages, Frameworks, Tools).`;
}

const tool = {
  function_declarations: [
    {
      name: "emit_resume",
      description: "Outputs the refined resume data in a structured format.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          website: { type: "string" },
          linkedin: { type: "string" },
          summary: { type: "string" },
          experience: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                role: { type: "string" },
                location: { type: "string" },
                period: { type: "string" },
                description: { type: "array", items: { type: "string" } },
              },
            },
          },
          education: {
            type: "array",
            items: {
              type: "object",
              properties: {
                school: { type: "string" },
                degree: { type: "string" },
                period: { type: "string" },
              },
            },
          },
          skills: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                items: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        required: ["full_name", "experience", "skills"],
      },
    },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Function refine-resume invoked");
    console.log("Content-Type:", req.headers.get("content-type"));
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    let jd = "";
    let forceOnePage = false;
    let b64 = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      try {
        const form = await req.formData();
        jd = String(form.get("jd") || "").trim();
        forceOnePage = String(form.get("force_one_page") || "false") === "true";
        const file = form.get("resume") as File | null;
        if (file) {
          const buf = new Uint8Array(await file.arrayBuffer());
          b64 = btoa(String.fromCharCode(...buf));
        }
      } catch (e) {
        console.error("FormData parsing failed:", e);
        throw new Error("Invalid form data: " + e.message);
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      jd = body.jd || "";
      forceOnePage = !!body.force_one_page;
      b64 = body.resume_b64 || "";
    } else {
      throw new Error("Unsupported content type: " + contentType);
    }
    
    if (!jd) return json({ error: "Job description required" }, 400);
    if (!b64) return json({ error: "Resume PDF (base64) required" }, 400);

    console.log("Calling Gemini with PDF data. B64 length:", b64.length);
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `SYSTEM INSTRUCTIONS:\n${buildSystemPrompt(forceOnePage)}\n\nJOB DESCRIPTION:\n${jd}` },
              { inline_data: { mime_type: "application/pdf", data: b64 } }
            ]
          }
        ],
        tools: [{ function_declarations: tool.function_declarations }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["emit_resume"] } }
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Gemini AI error:", aiRes.status, t);
      return json({ error: `AI error: ${aiRes.status}` }, 500);
    }

    const data = await aiRes.json();
    const call = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
    
    if (!call) {
      console.error("No tool call in response:", JSON.stringify(data));
      return json({ error: "AI failed to generate structured data" }, 500);
    }

    console.log("Success: Resume refined");
    return json({ resume: call.args });
  } catch (e) {
    console.error("CRITICAL ERROR:", e);
    return json({ 
      error: e instanceof Error ? e.message : "Unknown error",
      stack: e instanceof Error ? e.stack : null,
      debug_info: "Flexible Body Mode"
    }, 500);
  }
});


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
