import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Departments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["depts"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });
  const create = useMutation({
    mutationFn: async (v: any) => { const { error } = await supabase.from("departments").insert(v); if (error) throw error; },
    onSuccess: () => { toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["depts"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("departments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["depts"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({ name: f.get("name"), description: f.get("description") });
  };
  return (
    <div>
      <PageHeader title="Departments" description="Organize teams"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New department</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-2"><Label>Name</Label><Input name="name" required maxLength={100} /></div>
                <div className="space-y-2"><Label>Description</Label><Input name="description" maxLength={300} /></div>
                <Button type="submit" className="w-full" disabled={create.isPending}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        } />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map(d => (
          <Card key={d.id} className="p-5 shadow-card flex justify-between items-start">
            <div><h3 className="font-semibold">{d.name}</h3>{d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}</div>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
