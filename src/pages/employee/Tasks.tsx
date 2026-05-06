import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMyEmployee } from "@/lib/employee";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

const COLS = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
] as const;

const PRI: Record<string, string> = { low: "secondary", medium: "default", high: "destructive" };

export default function MyTasks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: emp } = useQuery({ queryKey: ["me-emp", user?.id], queryFn: () => getMyEmployee(user!.id), enabled: !!user });
  const { data: tasks } = useQuery({
    queryKey: ["my-tasks", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("tasks").select("*").eq("assigned_to", emp!.id).order("due_date", { ascending: true })).data ?? [],
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["my-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="My Tasks" description="Your assigned work" />
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map(col => (
          <div key={col.key}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {col.label}
              <Badge variant="secondary">{tasks?.filter(t => t.status === col.key).length ?? 0}</Badge>
            </h3>
            <div className="space-y-3">
              {tasks?.filter(t => t.status === col.key).map(t => (
                <Card key={t.id} className="p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium">{t.title}</h4>
                    <Badge variant={PRI[t.priority] as any} className="capitalize text-xs">{t.priority}</Badge>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mb-2">{t.description}</p>}
                  {t.due_date && <p className="text-xs text-muted-foreground">Due {format(new Date(t.due_date), "MMM d, yyyy")}</p>}
                  <Select value={t.status} onValueChange={(v) => update.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="mt-3 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{COLS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Card>
              ))}
              {!tasks?.filter(t => t.status === col.key).length && (
                <p className="text-xs text-muted-foreground text-center py-6">Nothing here</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
