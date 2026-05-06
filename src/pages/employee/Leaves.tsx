import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMyEmployee } from "@/lib/employee";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPES = ["annual", "sick", "casual", "maternity", "paternity", "unpaid"] as const;

export default function Leaves() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<typeof TYPES[number]>("annual");

  const { data: emp } = useQuery({ queryKey: ["me-emp", user?.id], queryFn: () => getMyEmployee(user!.id), enabled: !!user });

  const { data: leaves } = useQuery({
    queryKey: ["my-leaves", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("leaves").select("*").eq("employee_id", emp!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = useMutation({
    mutationFn: async (vals: { start: string; end: string; reason: string }) => {
      const { error } = await supabase.from("leaves").insert({
        employee_id: emp!.id, leave_type: type, start_date: vals.start, end_date: vals.end, reason: vals.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave request submitted"); setOpen(false); qc.invalidateQueries({ queryKey: ["my-leaves"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    submit.mutate({ start: String(f.get("start")), end: String(f.get("end")), reason: String(f.get("reason")) });
  };

  return (
    <div>
      <PageHeader title="My Leaves" description="Request and track time off"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-2"><Label>Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>From</Label><Input name="start" type="date" required /></div>
                  <div className="space-y-2"><Label>To</Label><Input name="end" type="date" required /></div>
                </div>
                <div className="space-y-2"><Label>Reason</Label><Textarea name="reason" required maxLength={500} /></div>
                <Button type="submit" className="w-full" disabled={submit.isPending}>Submit</Button>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {leaves?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="capitalize">{l.leave_type}</TableCell>
                <TableCell>{format(new Date(l.start_date), "MMM d")}</TableCell>
                <TableCell>{format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="max-w-xs truncate">{l.reason}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{l.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {!leaves?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
