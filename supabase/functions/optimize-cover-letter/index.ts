const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const SYSTEM_PROMPT = `You are a Senior Career Coach and Copywriter.
Your task is to tailor a cover letter to a specific Job Description (JD).

STRATEGY:
1. NATIVE EDITING: Identify phrases in the original letter that should be replaced with JD-specific keywords.
2. PARITY: The replacements must be roughly the same length as the originals to preserve the PDF layout.
3. IMPACT: Ensure the tone is professional, confident, and evidence-based.

Return the tailored letter data via the 'emit_edits' tool call.`;

const tool = {
  function_declarations: [
    {
      name: "emit_edits",
      description: "Outputs the tailored cover letter edits.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                find: { type: "string", description: "The exact text to find in the original" },
                replace: { type: "string", description: "The tailored text to replace it with" },
              },
            },
          },
        },
        required: ["edits"],
      },
    },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Function refine-cover-letter invoked");
    console.log("Content-Type:", req.headers.get("content-type"));
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    let jd = "";
    let b64 = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      try {
        const form = await req.formData();
        jd = String(form.get("jd") || "").trim();
        const file = form.get("letter") as File | null;
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
      b64 = body.letter_b64 || "";
    } else {
      throw new Error("Unsupported content type: " + contentType);
    }
    
    if (!jd) return json({ error: "Job description required" }, 400);
    if (!b64) return json({ error: "Letter PDF (base64) required" }, 400);

    console.log("Calling Gemini for cover letter tailoring. B64 length:", b64.length);
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `SYSTEM INSTRUCTIONS:\n${SYSTEM_PROMPT}\n\nTARGET JOB DESCRIPTION:\n${jd}` },
              { inline_data: { mime_type: "application/pdf", data: b64 } }
            ]
          }
        ],
        tools: [{ function_declarations: tool.function_declarations }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["emit_edits"] } }
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
      return json({ error: "AI failed to generate structured edits" }, 500);
    }

    console.log("Success: Cover letter tailored");
    return json(call.args);
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
