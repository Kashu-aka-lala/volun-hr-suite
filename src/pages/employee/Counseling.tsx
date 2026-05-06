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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Counseling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: emp } = useQuery({ queryKey: ["me-emp", user?.id], queryFn: () => getMyEmployee(user!.id), enabled: !!user });
  const { data: rows } = useQuery({
    queryKey: ["my-counsel", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("counseling_sessions").select("*").eq("employee_id", emp!.id).order("session_date", { ascending: false })).data ?? [],
  });

  const book = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("counseling_sessions").insert({
        employee_id: emp!.id, session_date: v.date, session_time: v.time, topic: v.topic, counselor_name: v.counselor,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session booked"); setOpen(false); qc.invalidateQueries({ queryKey: ["my-counsel"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    book.mutate({ date: f.get("date"), time: f.get("time"), topic: f.get("topic"), counselor: f.get("counselor") });
  };

  return (
    <div>
      <PageHeader title="Counseling" description="Schedule wellness sessions"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Book session</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule a session</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>Date</Label><Input name="date" type="date" required /></div>
                  <div className="space-y-2"><Label>Time</Label><Input name="time" type="time" required /></div>
                </div>
                <div className="space-y-2"><Label>Topic</Label><Input name="topic" required maxLength={200} /></div>
                <div className="space-y-2"><Label>Counselor</Label><Input name="counselor" required maxLength={100} /></div>
                <Button type="submit" className="w-full" disabled={book.isPending}>Book</Button>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Topic</TableHead><TableHead>Counselor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows?.map(s => (
              <TableRow key={s.id}>
                <TableCell>{format(new Date(s.session_date), "MMM d, yyyy")}</TableCell>
                <TableCell>{s.session_time}</TableCell>
                <TableCell>{s.topic}</TableCell>
                <TableCell>{s.counselor_name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{s.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!rows?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sessions yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
