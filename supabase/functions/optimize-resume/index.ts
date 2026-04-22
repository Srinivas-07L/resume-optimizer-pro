const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing in Supabase Secrets");

    const contentType = req.headers.get("content-type") || "";
    let jd = "";
    let b64 = "";
    let forceOnePage = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      jd = String(form.get("jd") || "");
      forceOnePage = String(form.get("force_one_page") || "false") === "true";
      const file = form.get("resume") as File | null;
      if (file) b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
    } else {
      const body = await req.json();
      jd = body.jd || "";
      b64 = body.resume_b64 || "";
      forceOnePage = !!body.force_one_page;
    }

    if (!jd || !b64) throw new Error("Missing JD or Resume file");

    const prompt = `Senior Recruiter mode. Return ONLY JSON for this resume optimized for this JD: ${jd}. ${forceOnePage ? "Target 1 page." : ""}`;

    // Try Flash
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: b64 } }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      // WE SEND THE EXACT GOOGLE ERROR TO THE UI SO YOU CAN SEE IT
      throw new Error(`Google API Error: ${aiRes.status} - ${errText}`);
    }

    const data = await aiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return json({ resume: JSON.parse(text) });

  } catch (e) {
    console.error("Critical Error:", e.message);
    return json({ error: e.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
