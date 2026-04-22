import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in Vercel' }, { status: 500 });
    }

    const formData = await req.formData();
    const jd = formData.get('jd') as string;
    const file = formData.get('resume') as File;
    const forceOnePage = formData.get('forceOnePage') === 'true';

    if (!jd || !file) {
      return NextResponse.json({ error: 'Missing Job Description or Resume file' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');

    // Use a very strict prompt for JSON instead of the response_mime_type field
    const prompt = `You are an expert ATS optimizer. Review the resume PDF and this JD: "${jd}".
    
    CRITICAL: You must return ONLY a raw JSON object. Do not include markdown formatting like \`\`\`json.
    
    JSON SCHEMA:
    {
      "name": "Full Name",
      "summary": "Professional summary...",
      "experience": [{"role": "Role", "company": "Company", "dates": "Dates", "description": ["bullets"]}],
      "education": [{"degree": "Degree", "school": "School", "dates": "Dates"}],
      "skills": ["Skill 1"],
      "match_score_before": 0,
      "match_score_after": 100,
      "keywords_added": ["list"]
    }`;

    // SMART SCANNER: Try multiple combinations without the problematic response_mime_type field
    const targets = [
      { ver: "v1beta", mod: "gemini-1.5-flash" },
      { ver: "v1", mod: "gemini-1.5-flash" },
      { ver: "v1beta", mod: "gemini-1.5-pro" }
    ];

    let lastError = "";
    let successData = null;

    for (const target of targets) {
      const response = await fetch(`https://generativelanguage.googleapis.com/${target.ver}/models/${target.mod}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: b64 } }]
          }]
        })
      });

      if (response.ok) {
        successData = await response.json();
        break;
      }
      lastError = await response.text();
    }

    if (!successData) {
      return NextResponse.json({ error: `AI Scan Failed: ${lastError}` }, { status: 500 });
    }

    let resultText = successData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Clean up markdown if the AI ignored the instruction
    if (resultText.includes('```')) {
      resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    return NextResponse.json(JSON.parse(resultText));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
