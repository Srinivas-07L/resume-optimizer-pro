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
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

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

    // Optimized target for PDF processing (using the latest available 2.5 Flash model)
    const target = { ver: "v1beta", mod: "gemini-2.5-flash" };

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

    const responseText = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: `AI Error (${response.status}): ${responseText}` }, { status: 500 });
    }

    let successData;
    try {
      successData = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json({ error: `Invalid JSON from AI: ${responseText.substring(0, 100)}` }, { status: 500 });
    }

    let text = successData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Clean up any markdown code blocks
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch (e) {
      return NextResponse.json({ error: `AI returned invalid schema: ${text.substring(0, 100)}` }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
