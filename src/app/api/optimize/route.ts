import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const formData = await req.formData();
    const jd = formData.get('jd') as string;
    const file = formData.get('resume') as File;

    if (!jd || !file) return NextResponse.json({ error: 'Missing JD or Resume' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const b64 = btoa(Array.from(new Uint8Array(arrayBuffer)).map(b => String.fromCharCode(b)).join(''));

    const prompt = `You are an expert ATS optimizer. Review the resume PDF and this JD: "${jd}".
    Return ONLY a raw JSON object. SCHEMA:
    {
      "name": "Name",
      "summary": "Summary",
      "experience": [{"role": "Role", "company": "Company", "dates": "Dates", "description": ["bullets"]}],
      "education": [],
      "skills": [],
      "match_score_before": 0,
      "match_score_after": 100,
      "keywords_added": []
    }`;

    // Optimized target for PDF processing
    const target = { ver: "v1beta", mod: "gemini-1.5-flash-latest" };

    const response = await fetch(`https://generativelanguage.googleapis.com/${target.ver}/models/${target.mod}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt }, 
            { inline_data: { mime_type: 'application/pdf', data: b64 } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `AI Error (${response.status}): ${errorText}` }, { status: 500 });
    }

    const successData = await response.json();

    let text = successData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Clean up any markdown code blocks
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
