import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Approvals() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "pending" }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["pending-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Account Approvals" description="Approve or reject new user accounts" />
      <Card className="shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Badge variant={u.status === "approved" ? "default" : u.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{u.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {u.status !== "approved" && <Button size="sm" onClick={() => setStatus.mutate({ id: u.id, status: "approved" })}>Approve</Button>}
                  {u.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: u.id, status: "rejected" })}>Reject</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
