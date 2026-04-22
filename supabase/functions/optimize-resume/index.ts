const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Optimize-Resume: Invoked");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in Supabase Secrets");

    let jd = "";
    let b64 = "";
    let forceOnePage = false;

    // FLEXIBLE PARSING: Support FormData AND JSON
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      try {
        const form = await req.formData();
        jd = String(form.get("jd") || "");
        forceOnePage = String(form.get("force_one_page") || "false") === "true";
        const file = form.get("resume") as File | null;
        if (file) {
          b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
        }
      } catch (e) {
        console.error("FormData error, trying JSON fallback...");
        // If formData fails, we fall through to JSON check
      }
    }

    if (!b64) {
      try {
        const body = await req.json();
        jd = body.jd || jd;
        forceOnePage = !!body.force_one_page || forceOnePage;
        b64 = body.resume_b64 || "";
      } catch (e) {
        console.error("JSON parsing also failed or was not provided.");
      }
    }

    if (!jd) throw new Error("Job description is missing.");
    if (!b64) throw new Error("Resume PDF data is missing (tried Form and JSON).");

    const prompt = `You are a Senior Recruiter. Optimize this resume for the following Job Description.
    JD: ${jd}
    Goal: ${forceOnePage ? "Keep it to exactly 1 page." : "Optimize for impact and keywords."}
    
    Return ONLY a JSON object:
    {
      "full_name": "...",
      "email": "...",
      "phone": "...",
      "location": "...",
      "summary": "...",
      "experience": [{"company": "...", "role": "...", "period": "...", "description": ["..."]}],
      "education": [{"school": "...", "degree": "...", "period": "..."}],
      "skills": [{"category": "...", "items": ["..."]}]
    }`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "application/pdf", data: b64 } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini API Error: ${JSON.stringify(data)}`);
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return json({ resume: JSON.parse(text) });

  } catch (e) {
    console.error("Optimize-Resume Error:", e.message);
    return json({ error: e.message, debug_info: "Flexible Parsing Mode" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
