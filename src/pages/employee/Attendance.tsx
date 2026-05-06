import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMyEmployee } from "@/lib/employee";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: emp } = useQuery({ queryKey: ["me-emp", user?.id], queryFn: () => getMyEmployee(user!.id), enabled: !!user });

  const { data: todayRec } = useQuery({
    queryKey: ["att-today", emp?.id],
    enabled: !!emp,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", emp!.id).eq("date", today).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["att-history", emp?.id],
    enabled: !!emp,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("employee_id", emp!.id).order("date", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const lateMin = Math.max(0, (now.getHours() - 9) * 60 + now.getMinutes());
      const { error } = await supabase.from("attendance").insert({
        employee_id: emp!.id, date: today, check_in: now.toISOString(),
        late_minutes: lateMin, status: lateMin > 0 ? "late" : "present",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["att-today"] }); qc.invalidateQueries({ queryKey: ["att-history"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const inT = todayRec?.check_in ? new Date(todayRec.check_in) : now;
      const hours = +(((+now - +inT) / 36e5).toFixed(2));
      const { error } = await supabase.from("attendance").update({ check_out: now.toISOString(), working_hours: hours }).eq("id", todayRec!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checked out"); qc.invalidateQueries({ queryKey: ["att-today"] }); qc.invalidateQueries({ queryKey: ["att-history"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Attendance" description="Track your daily check-in and check-out" />
      <Card className="p-6 mb-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Today, {format(new Date(), "EEEE, MMM d")}</p>
            <div className="flex gap-6 mt-2">
              <div><p className="text-xs text-muted-foreground">Check in</p><p className="font-semibold">{todayRec?.check_in ? format(new Date(todayRec.check_in), "HH:mm") : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Check out</p><p className="font-semibold">{todayRec?.check_out ? format(new Date(todayRec.check_out), "HH:mm") : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Hours</p><p className="font-semibold">{todayRec?.working_hours ?? 0}</p></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => checkIn.mutate()} disabled={!!todayRec?.check_in || checkIn.isPending}>Check in</Button>
            <Button variant="outline" onClick={() => checkOut.mutate()} disabled={!todayRec?.check_in || !!todayRec?.check_out || checkOut.isPending}>Check out</Button>
          </div>
        </div>
      </Card>
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {history?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                <TableCell>{r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}</TableCell>
                <TableCell>{r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}</TableCell>
                <TableCell>{r.working_hours}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!history?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No records yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
