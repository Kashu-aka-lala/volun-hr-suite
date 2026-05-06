import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminLeaves() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["all-leaves"],
    queryFn: async () => (await supabase.from("leaves").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false })).data ?? [],
  });
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leaves").update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["all-leaves"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title="Leave Requests" description="Approve or reject employee requests" />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell>{l.employees?.full_name}</TableCell>
                <TableCell className="capitalize">{l.leave_type}</TableCell>
                <TableCell>{format(new Date(l.start_date), "MMM d")} → {format(new Date(l.end_date), "MMM d, yyyy")}</TableCell>
                <TableCell className="max-w-xs truncate">{l.reason}</TableCell>
                <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{l.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  {l.status === "pending" && <>
                    <Button size="sm" onClick={() => decide.mutate({ id: l.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: l.id, status: "rejected" })}>Reject</Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
