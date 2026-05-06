import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function AdminAttendance() {
  const { data } = useQuery({
    queryKey: ["all-att"],
    queryFn: async () => (await supabase.from("attendance").select("*, employees(full_name, employee_code)").order("date", { ascending: false }).limit(100)).data ?? [],
  });
  return (
    <div>
      <PageHeader title="Attendance Overview" description="Recent attendance across the organization" />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.employees?.full_name} <span className="text-xs text-muted-foreground">{r.employees?.employee_code}</span></TableCell>
                <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                <TableCell>{r.check_in ? format(new Date(r.check_in), "HH:mm") : "—"}</TableCell>
                <TableCell>{r.check_out ? format(new Date(r.check_out), "HH:mm") : "—"}</TableCell>
                <TableCell>{r.working_hours}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
