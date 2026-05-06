import os
import json
import io
import PyPDF2
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

class JobData(BaseModel):
    title: str
    required_skills: List[str]
    experience_required: int

@app.post("/parse-cv")
async def parse_cv(file: UploadFile = File(...)):
    try:
        # 1. Extract text from PDF
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()

        # 2. Use Gemini to extract structured JSON
        prompt = f"""
        Extract structured candidate information from this CV text. 
        Return ONLY a JSON object with these keys: name, skills (list), experience_years (int), education (string), projects (list).
        
        CV Text:
        {text}
        """
        
        response = model.generate_content(prompt)
        # Clean up JSON response
        json_str = response.text.strip().replace('```json', '').replace('```', '').strip()
        parsed_data = json.loads(json_str)
        
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/match")
async def match_candidate(candidate_data: dict, job_data: JobData):
    try:
        # 1. Scoring Logic
        # Skill Match (60%)
        candidate_skills = [s.lower() for s in candidate_data.get('skills', [])]
        required_skills = [s.lower() for s in job_data.required_skills]
        
        matched_skills = [s for s in required_skills if any(s in cs for cs in candidate_skills)]
        skill_match_score = (len(matched_skills) / len(required_skills)) * 100 if required_skills else 100
        
        # Experience Match (40%)
        candidate_exp = candidate_data.get('experience_years', 0)
        exp_match_score = min((candidate_exp / job_data.experience_required) * 100 if job_data.experience_required > 0 else 100, 100)
        
        total_score = (skill_match_score * 0.6) + (exp_match_score * 0.4)

        # 2. AI Insights
        prompt = f"""
        Compare this candidate with the job requirements.
        Candidate: {json.dumps(candidate_data)}
        Job: {job_data.json()}
        
        Return ONLY a JSON object with keys: strengths (string), weaknesses (string), recommendation (string), missing_skills (list).
        """
        
        response = model.generate_content(prompt)
        json_str = response.text.strip().replace('```json', '').replace('```', '').strip()
        insights = json.loads(json_str)
        
        return {
            "score": round(total_score, 2),
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
