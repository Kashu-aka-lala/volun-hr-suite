
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'on_leave');
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid');
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.session_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status public.account_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;

-- ============ DEPARTMENTS ============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ EMPLOYEES ============
CREATE SEQUENCE public.employee_id_seq START 1001;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE DEFAULT ('EMP-' || nextval('public.employee_id_seq')::TEXT),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  designation TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_department ON public.employees(department_id);

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  working_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);
CREATE INDEX idx_attendance_employee_date ON public.attendance(employee_id, date);

-- ============ LEAVES ============
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leaves_employee ON public.leaves(employee_id);

-- ============ PAYROLL ============
CREATE TABLE public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonuses NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) GENERATED ALWAYS AS (basic_salary + allowances + bonuses - deductions - tax) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period_month, period_year)
);
CREATE INDEX idx_payroll_employee ON public.payroll(employee_id);

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);

-- ============ COUNSELING ============
CREATE TABLE public.counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  topic TEXT NOT NULL,
  counselor_name TEXT NOT NULL,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_counseling_employee ON public.counseling_sessions(employee_id);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user handler: profile + role. First user becomes approved admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
  is_first BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  is_first := user_count = 0;

  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_first THEN 'approved'::public.account_status ELSE 'pending'::public.account_status END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END);

  -- Auto-create employee record for non-admin users
  IF NOT is_first THEN
    INSERT INTO public.employees (user_id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_sessions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- departments
CREATE POLICY "Approved users view departments" ON public.departments FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- employees
CREATE POLICY "Employees view self" ON public.employees FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_approved(auth.uid()));
CREATE POLICY "Admins view employees" ON public.employees FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- attendance
CREATE POLICY "Employees view own attendance" ON public.attendance FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees manage own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees update own attendance" ON public.attendance FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- leaves
CREATE POLICY "Employees view own leaves" ON public.leaves FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leaves.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees create own leaves" ON public.leaves FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leaves.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Admins manage leaves" ON public.leaves FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- payroll
CREATE POLICY "Employees view own payroll" ON public.payroll FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Admins manage payroll" ON public.payroll FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- tasks
CREATE POLICY "Employees view own tasks" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = tasks.assigned_to AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = tasks.assigned_to AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Admins manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- counseling
CREATE POLICY "Employees view own sessions" ON public.counseling_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = counseling_sessions.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees create own sessions" ON public.counseling_sessions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = counseling_sessions.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Employees update own sessions" ON public.counseling_sessions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = counseling_sessions.employee_id AND e.user_id = auth.uid()) AND public.is_approved(auth.uid())
);
CREATE POLICY "Admins manage sessions" ON public.counseling_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
