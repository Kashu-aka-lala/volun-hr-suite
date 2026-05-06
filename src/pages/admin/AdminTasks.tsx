import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminTasks() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [priority, setPriority] = useState<"low"|"medium"|"high">("medium");

  const { data: emps } = useQuery({ queryKey: ["all-emps-min"], queryFn: async () => (await supabase.from("employees").select("id, full_name, employee_code")).data ?? [] });
  const { data: tasks } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*, employees(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (v: any) => { const { error } = await supabase.from("tasks").insert({ ...v, assigned_by: user!.id }); if (error) throw error; },
    onSuccess: () => { toast.success("Task created"); setOpen(false); qc.invalidateQueries({ queryKey: ["all-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["all-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      title: f.get("title"), description: f.get("description"), assigned_to: assignTo,
      priority, due_date: f.get("due_date") || null, tag: f.get("tag") || null,
    });
  };

  return (
    <div>
      <PageHeader title="Tasks" description="Assign and track work"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign task</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-2"><Label>Title</Label><Input name="title" required maxLength={200} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea name="description" maxLength={1000} /></div>
                <div className="space-y-2"><Label>Assign to</Label>
                  <Select value={assignTo} onValueChange={setAssignTo} required>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{emps?.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>Priority</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["low","medium","high"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Due date</Label><Input name="due_date" type="date" /></div>
                </div>
                <div className="space-y-2"><Label>Tag</Label><Input name="tag" maxLength={50} placeholder="optional project/team" /></div>
                <Button type="submit" className="w-full" disabled={create.isPending || !assignTo}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Assignee</TableHead><TableHead>Priority</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {tasks?.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.employees?.full_name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{t.priority}</Badge></TableCell>
                <TableCell>{t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{t.status.replace("_"," ")}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
