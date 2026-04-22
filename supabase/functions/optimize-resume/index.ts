const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Optimize-Resume: Invoked");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    
    // Log key format for debugging (safe)
    console.log(`Key Check: Length=${GEMINI_API_KEY.length}, Start=${GEMINI_API_KEY.substring(0,3)}..., End=...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length-3)}`);

    const form = await req.formData();
    const jd = String(form.get("jd") || "");
    const file = form.get("resume") as File | null;
    const forceOnePage = String(form.get("force_one_page") || "false") === "true";

    if (!jd || !file) return json({ error: "Missing JD or Resume" }, 400);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));

    const prompt = `Senior Recruiter mode. Return ONLY JSON for this resume optimized for this JD: ${jd}. ${forceOnePage ? "Target 1 page." : ""}`;

    // Try Flash first, then Pro as fallback
    let aiRes;
    const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
    let lastError = "";

    for (const model of models) {
      console.log(`Trying model: ${model}`);
      aiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "application/pdf", data: b64 } }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (aiRes.ok) break;
      lastError = await aiRes.text();
      console.error(`${model} failed: ${lastError}`);
    }

    if (!aiRes.ok) throw new Error(`All AI models failed. Last error: ${lastError}`);

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
