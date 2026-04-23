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

    const prompt = `You are an ELITE Resume Engineer. Your goal is to re-write this resume to achieve a 95%+ ATS match for this Job Description: "${jd}".

    CRITICAL EXTRACTION:
    - Extract the user's FULL NAME, EMAIL, PHONE, LINKEDIN, and GITHUB from the provided resume PDF. 
    - If any link/detail is missing, leave it as an empty string.

    RE-WRITING RULES (FOR 95%+ ATS SCORE):
    1. KEYWORD MIRRORING: Identify all technical nouns (tools, software, methods) in the JD. Ensure they appear EXACTLY as written in the JD. If JD uses acronyms, use 'Full Term (Acronym)'.
    2. RUTHLESS CONCISCENESS: Re-write every experience bullet to be short, punchy, and result-oriented. Ensure it fits on 1 page.
    3. STRUCTURE: Use only these headers: 'Executive Summary', 'Technical Skills', 'Professional Experience', 'Education', 'Awards & Accomplishments'.
    4. NO NOISE: Remove photos, icons, and progress bars. Focus on searchable UTF-8 text.

    Return ONLY a raw JSON object. 
    SCHEMA:
    {
      "name": "Extracted Full Name",
      "email": "Extracted Email",
      "phone": "Extracted Phone",
      "linkedin": "Extracted LinkedIn URL",
      "github": "Extracted GitHub URL",
      "location": "Extracted City/State",
      "summary": "3-4 line summary connecting skills to the role requirements",
      "experience": [{"role": "Role", "company": "Company", "dates": "Dates", "description": ["3-5 optimized bullets"]}],
      "education": [{"degree": "Degree", "school": "School", "date": "Date"}],
      "skills": ["Keyword1", "Keyword2", "Exactly matching JD"],
      "match_score_before": 0,
      "match_score_after": 98,
      "keywords_added": ["List of JD keywords synced"]
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
