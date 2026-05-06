import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Users, Calendar, Briefcase, CheckSquare, Clock, DollarSign } from "lucide-react";

function Stat({ label, value, icon: Icon, accent }: any) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { role, user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dash", role, user?.id],
    queryFn: async () => {
      if (role === "admin") {
        const [emp, leaves, tasks, pending] = await Promise.all([
          supabase.from("employees").select("id", { count: "exact", head: true }),
          supabase.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);
        return { employees: emp.count ?? 0, leaves: leaves.count ?? 0, tasks: tasks.count ?? 0, pending: pending.count ?? 0 };
      }
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle();
      if (!emp) return { tasks: 0, leaves: 0, attendance: 0 };
      const [tasks, leaves, att] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", emp.id).neq("status", "completed"),
        supabase.from("leaves").select("id", { count: "exact", head: true }).eq("employee_id", emp.id).eq("status", "pending"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", emp.id),
      ]);
      return { tasks: tasks.count ?? 0, leaves: leaves.count ?? 0, attendance: att.count ?? 0 };
    },
  });

  return (
    <div>
      <PageHeader
        title={role === "admin" ? "Admin Dashboard" : "My Dashboard"}
        description={role === "admin" ? "Organization overview" : "Your activity at a glance"}
      />
      {role === "admin" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Employees" value={stats?.employees ?? 0} icon={Users} accent="bg-primary/10 text-primary" />
          <Stat label="Pending leaves" value={stats?.leaves ?? 0} icon={Briefcase} accent="bg-warning/10 text-warning" />
          <Stat label="Active tasks" value={stats?.tasks ?? 0} icon={CheckSquare} accent="bg-accent/10 text-accent" />
          <Stat label="Pending approvals" value={stats?.pending ?? 0} icon={Clock} accent="bg-destructive/10 text-destructive" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Active tasks" value={stats?.tasks ?? 0} icon={CheckSquare} accent="bg-primary/10 text-primary" />
          <Stat label="Pending leaves" value={stats?.leaves ?? 0} icon={Briefcase} accent="bg-warning/10 text-warning" />
          <Stat label="Attendance records" value={stats?.attendance ?? 0} icon={Calendar} accent="bg-accent/10 text-accent" />
        </div>
      )}
      <Card className="p-6 mt-6 shadow-card">
        <h3 className="font-semibold mb-2">Welcome to DeVerse IT Solutions</h3>
        <p className="text-muted-foreground text-sm">
          {role === "admin"
            ? "Use the sidebar to manage employees, approve leave requests, run payroll, and assign tasks."
            : "Use the sidebar to check in, request time off, view your tasks, and book counseling sessions."}
        </p>
      </Card>
    </div>
  );
}
