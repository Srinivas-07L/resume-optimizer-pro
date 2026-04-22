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

    // Convert PDF to Base64
    const arrayBuffer = await file.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `You are an expert ATS (Applicant Tracking System) optimizer. 
    Review the provided resume PDF and the following Job Description: "${jd}".
    
    TASKS:
    1. Rewrite the resume to mirror the most important keywords and requirements from the JD.
    2. Maintain a professional, executive tone.
    3. ${forceOnePage ? "Crucial: Optimize the length to fit exactly 1 page." : "Maintain appropriate length."}
    4. Return ONLY a valid JSON object in this format:
    {
      "name": "Full Name",
      "summary": "Professional summary...",
      "experience": [{"role": "Title", "company": "Company", "dates": "Dates", "description": ["bullet 1", "bullet 2"]}],
      "education": [{"degree": "Degree", "school": "School", "dates": "Dates"}],
      "skills": ["Skill 1", "Skill 2"],
      "match_score_before": 0-100,
      "match_score_after": 0-100,
      "keywords_added": ["list of key terms added"]
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'application/pdf', data: b64 } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Google API Error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      return NextResponse.json({ error: 'AI failed to generate a response' }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(resultText));

  } catch (error: any) {
    console.error('Optimization Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
