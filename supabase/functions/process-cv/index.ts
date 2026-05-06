import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileBase64, jobData } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 200, headers: corsHeaders })
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `
              You are a Strict HR Bot.
              Analyze the resume for the job: ${JSON.stringify(jobData)}.
              
              CRITICAL: You MUST provide a score between 10 and 100. Never 0.
              If the candidate has ANY skill listed in the job requirements, the score MUST be at least 50.
              
              Return ONLY JSON:
              {
                "name": "Candidate Name",
                "skills": ["Skill1", "Skill2"],
                "experience_years": 5,
                "education": "Degree",
                "projects": ["Project1"],
                "score": 85,
                "insights": {
                  "strengths": "Strengths here",
                  "weaknesses": "Weaknesses here",
                  "recommendation": "Verdict here",
                  "missing_skills": ["Missing1"]
                }
              }
            ` },
            { inline_data: { mime_type: "application/pdf", data: fileBase64 } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Gemini API Error", details: data.error?.message }), { status: 200, headers: corsHeaders })
    }

    let aiText = data.candidates[0].content.parts[0].text
    const finalData = JSON.parse(aiText)

    // Final safety check
    if (!finalData.score || finalData.score < 10) {
      finalData.score = 55; // Default score for successful parsing
    }

    return new Response(JSON.stringify(finalData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: "Processing Error", details: error.message }), { status: 200, headers: corsHeaders })
  }
})
