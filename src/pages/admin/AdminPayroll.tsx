import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AdminPayroll() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState<string>("");
  const { data: emps } = useQuery({ queryKey: ["all-emps-min"], queryFn: async () => (await supabase.from("employees").select("id, full_name, employee_code")).data ?? [] });
  const { data: rows } = useQuery({
    queryKey: ["all-payroll"],
    queryFn: async () => (await supabase.from("payroll").select("*, employees(full_name, employee_code)").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });
  const create = useMutation({
    mutationFn: async (v: any) => { const { error } = await supabase.from("payroll").insert(v); if (error) throw error; },
    onSuccess: () => { toast.success("Salary recorded"); setOpen(false); qc.invalidateQueries({ queryKey: ["all-payroll"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      employee_id: empId, period_month: Number(f.get("month")), period_year: Number(f.get("year")),
      basic_salary: Number(f.get("basic")), allowances: Number(f.get("allow")), bonuses: Number(f.get("bonus")),
      deductions: Number(f.get("ded")), tax: Number(f.get("tax")),
    });
  };
  return (
    <div>
      <PageHeader title="Payroll" description="Manage monthly salaries"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add salary</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New salary record</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-2"><Label>Employee</Label>
                  <Select value={empId} onValueChange={setEmpId} required>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{emps?.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>Month</Label><Input name="month" type="number" min={1} max={12} required /></div>
                  <div className="space-y-2"><Label>Year</Label><Input name="year" type="number" defaultValue={new Date().getFullYear()} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2"><Label>Basic</Label><Input name="basic" type="number" step="0.01" defaultValue={0} required /></div>
                  <div className="space-y-2"><Label>Allowances</Label><Input name="allow" type="number" step="0.01" defaultValue={0} required /></div>
                  <div className="space-y-2"><Label>Bonuses</Label><Input name="bonus" type="number" step="0.01" defaultValue={0} required /></div>
                  <div className="space-y-2"><Label>Deductions</Label><Input name="ded" type="number" step="0.01" defaultValue={0} required /></div>
                  <div className="space-y-2"><Label>Tax</Label><Input name="tax" type="number" step="0.01" defaultValue={0} required /></div>
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending || !empId}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Basic</TableHead><TableHead>Net</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.employees?.full_name}</TableCell>
                <TableCell>{M[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell>{r.basic_salary}</TableCell>
                <TableCell className="font-semibold">{r.net_salary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
