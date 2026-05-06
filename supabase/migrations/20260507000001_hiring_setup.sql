
-- ============ HIRING MODULE TABLES ============

-- 1. Jobs Table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_required INTEGER NOT NULL DEFAULT 0,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Candidates Table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  cv_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Applications Table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  parsed_data JSONB, -- Stores {skills: [], experience_years: int, education: string, etc.}
  match_score FLOAT DEFAULT 0,
  ai_evaluation JSONB, -- Stores {strengths: string, weaknesses: string, recommendation: string}
  status TEXT NOT NULL DEFAULT 'applied', -- applied, interviewing, rejected, hired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ RLS POLICIES ============

-- Jobs: Public can view open jobs, Admins can manage all
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view open jobs" ON public.jobs FOR SELECT USING (status = 'open');
CREATE POLICY "Admins manage jobs" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Candidates: Public can insert, Admins can view all
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit candidate profile" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view candidates" ON public.candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Applications: Public can insert, Admins can view/manage all
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can apply" ON public.applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage applications" ON public.applications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ INDEXES ============
CREATE INDEX idx_jobs_dept ON public.jobs(department_id);
CREATE INDEX idx_apps_job ON public.applications(job_id);
CREATE INDEX idx_apps_candidate ON public.applications(candidate_id);
CREATE INDEX idx_apps_score ON public.applications(match_score DESC);
