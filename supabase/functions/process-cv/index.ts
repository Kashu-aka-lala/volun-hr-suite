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

    // Attempting with v1beta
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `
              Analyze the attached resume and match it against this job:
              ${JSON.stringify(jobData)}
              
              Return a JSON object with these fields:
              - name: string
              - skills: string[]
              - experience_years: number
              - education: string
              - projects: string[]
              - score: number (0-100)
              - insights: { strengths: string, weaknesses: string, recommendation: string, missing_skills: string[] }
              
              Be very critical with the score. If skills match perfectly, score > 80. If not, score < 50.
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
      return new Response(JSON.stringify({ error: "Gemini Error", details: data.error?.message }), { status: 200, headers: corsHeaders })
    }

    const aiText = data.candidates[0].content.parts[0].text
    const finalData = JSON.parse(aiText)

    // Fallback for missing score
    if (finalData.score === undefined) {
      finalData.score = 50; 
    }

    return new Response(JSON.stringify(finalData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: "Edge Error", details: error.message }), { status: 200, headers: corsHeaders })
  }
})
