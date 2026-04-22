const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Optimize-Cover-Letter: Invoked");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in Supabase Secrets");

    const form = await req.formData();
    const jd = String(form.get("jd") || "");
    const file = form.get("letter") as File | null;

    if (!jd || !file) return json({ error: "Job description and Cover Letter PDF are required." }, 400);

    const b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));

    const prompt = `Tailor this cover letter for the following Job Description.
    JD: ${jd}
    
    Return ONLY a JSON object:
    {
      "company_name": "...",
      "edits": [{"find": "old text", "replace": "new tailored text"}]
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
    return json(JSON.parse(text));

  } catch (e) {
    console.error("Optimize-Cover-Letter Error:", e.message);
    return json({ error: e.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
