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

    const form = await req.formData();
    const jd = String(form.get("jd") || "");
    const file = form.get("resume") as File | null;
    const forceOnePage = String(form.get("force_one_page") || "false") === "true";

    if (!jd || !file) return json({ error: "Job description and Resume PDF are required." }, 400);

    const b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));

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
    return json({ error: e.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
