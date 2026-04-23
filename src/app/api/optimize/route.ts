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
    
    TECHNICAL CONSTRAINTS:
    1. Standard Headers Only: Use ONLY: 'Executive Summary', 'Technical Skills', 'Professional Experience', 'Education', and 'Awards & Accomplishments'.
    2. Linear Flow: No sidebars, no tables, no overlapping elements.
    3. Keyword Mirroring: Extract technical nouns from the JD and ensure they appear EXACTLY as written. If JD uses acronyms, use both: 'Full Term (Acronym)'.
    4. Removal of Noise: No photos, icons, progress bars, or tables.
    5. One-Page Ruthlessness: Be extremely concise with bullet points to ensure a single-page fit.
    
    Return ONLY a raw JSON object. SCHEMA:
    {
      "name": "Full Name",
      "summary": "Impactful Executive Summary",
      "experience": [{"role": "Role", "company": "Company", "dates": "Dates", "description": ["ruthlessly concise bullets"]}],
      "education": [{"degree": "Degree", "school": "School", "date": "Date"}],
      "skills": ["Keyword1", "Keyword2"],
      "match_score_before": 0,
      "match_score_after": 100,
      "keywords_added": []
    }`;

    // Use Gemini 2.0 Flash which is more stable than the 2.5 preview
    const models = ["gemini-2.0-flash", "gemini-flash-latest"];
    let lastError = "";

    for (const modelName of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
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
          lastError = `Model ${modelName} failed (${response.status}): ${responseText}`;
          continue; // Try next model
        }

        const successData = JSON.parse(responseText);
        let text = successData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        return NextResponse.json(JSON.parse(text));

      } catch (e: any) {
        lastError = e.message;
        continue;
      }
    }

    return NextResponse.json({ error: `All models failed. Last error: ${lastError}` }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
