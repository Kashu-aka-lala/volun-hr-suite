import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMyEmployee } from "@/lib/employee";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MyPayroll() {
  const { user } = useAuth();
  const { data: emp } = useQuery({ queryKey: ["me-emp", user?.id], queryFn: () => getMyEmployee(user!.id), enabled: !!user });
  const { data: rows } = useQuery({
    queryKey: ["my-payroll", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("payroll").select("*").eq("employee_id", emp!.id).order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });
  return (
    <div>
      <PageHeader title="My Payroll" description="Salary slips" />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Bonuses</TableHead><TableHead>Deductions</TableHead><TableHead>Tax</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows?.map(r => (
              <TableRow key={r.id}>
                <TableCell>{M[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell>{r.basic_salary}</TableCell><TableCell>{r.allowances}</TableCell>
                <TableCell>{r.bonuses}</TableCell><TableCell>{r.deductions}</TableCell><TableCell>{r.tax}</TableCell>
                <TableCell className="text-right font-semibold">{r.net_salary}</TableCell>
              </TableRow>
            ))}
            {!rows?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No salary records yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
