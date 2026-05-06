import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set')
    }

    // 1. Send PDF to Gemini for parsing and matching
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `
              You are an AI HR Expert. 
              Task 1: Extract candidate info from the provided PDF.
              Task 2: Compare the candidate with these Job Requirements: ${JSON.stringify(jobData)}.
              
              Calculate Match Score: (Skill Match % * 0.6) + (Experience Match % * 0.4).
              
              Return ONLY a JSON object with these exact keys:
              - name (string)
              - skills (list)
              - experience_years (int)
              - education (string)
              - projects (list)
              - score (float, 0-100)
              - insights: { strengths: string, weaknesses: string, recommendation: string, missing_skills: list }
            ` },
            { inline_data: { mime_type: "application/pdf", data: fileBase64 } }
          ]
        }]
      })
    })

    const result = await response.json()
    const aiText = result.candidates[0].content.parts[0].text
    const jsonStr = aiText.replace(/```json|```/g, "").trim()
    const finalData = JSON.parse(jsonStr)

    return new Response(JSON.stringify(finalData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
