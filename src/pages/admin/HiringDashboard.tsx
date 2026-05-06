import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Award,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Plus,
  Briefcase,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Database,
  XCircle,
} from "lucide-react";

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

export default function HiringDashboard() {
  // ── Lifted dialog state (prevents white-screen flash from map nesting) ──
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  // Keep a stable ref so the mutation closure never sees stale data
  const selectedAppRef = useRef<any>(null);

  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [filterJobId, setFilterJobId] = useState<string>("all");

  // Track mutation result for inline status display in dialog
  const [mutationResult, setMutationResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const queryClient = useQueryClient();

  // ─────────────────────────────────────────────────────────────────────────
  // DATA QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  const { data: applications, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications" as any)
        .select(`*, jobs(title, required_skills), candidates(name, email, cv_url)`)
        .order("match_score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs" as any)
        .select("*, departments(name)");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*");
      if (error) throw error;
      return data;
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MUTATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * STATUS MUTATION: Uses SECURITY DEFINER RPC to bypass RLS.
   * This is the guaranteed write path — no silent failures.
   */
  const statusMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      setMutationResult(null);

      const { data, error } = await supabase.rpc("update_application_status" as any, {
        p_application_id: appId,
        p_status: status,
      });

      if (error) {
        throw new Error(`RPC Error: ${error.message}`);
      }

      // The RPC returns a JSON object with success/error fields
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || "DB returned 0 rows affected — ID mismatch?");
      }

      return result;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });

      if (variables.status === "rejected") {
        // Application is deleted from DB — close dialog and let table refetch remove the row
        toast.success("Candidate rejected and removed from the list.");
        setEvalDialogOpen(false);
        setTimeout(() => {
          setSelectedApp(null);
          selectedAppRef.current = null;
          setMutationResult(null);
        }, 200);
        return;
      }

      // Hired: update local state so badge updates instantly without re-open
      if (selectedAppRef.current?.id === variables.appId) {
        const updated = { ...selectedAppRef.current, status: "hired" };
        selectedAppRef.current = updated;
        setSelectedApp(updated);
      }

      const empMsg = result.employee_created
        ? "✅ Hired & added to Employees list!"
        : "✅ Hired! (Employee record already existed)";

      setMutationResult({ type: "success", message: empMsg });
      toast.success(
        result.employee_created
          ? "Candidate hired — new employee record created!"
          : "Candidate hired — employee already in system."
      );
    },
    onError: (err: any) => {
      const msg = err.message || "Unknown database error";
      setMutationResult({ type: "error", message: msg });
      toast.error(`DB Error: ${msg}`);
      console.error("STATUS MUTATION FAILED:", err);
    },
  });

  const jobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      if (editingJob) {
        const { error } = await supabase
          .from("jobs" as any)
          .update(jobData)
          .eq("id", editingJob.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jobs" as any).insert(jobData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(editingJob ? "Job updated" : "Job posted successfully!");
      setIsJobDialogOpen(false);
      setEditingJob(null);
      setSelectedDept("");
    },
    onError: (err: any) => {
      toast.error(`Failed to save job: ${err.message}`);
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.rpc("delete_job", { p_job_id: jobId });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Failed to delete job");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job posting deleted");
    },
    onError: (err: any) => {
      toast.error(`Error deleting job: ${err.message}`);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const openEvalDialog = (app: any) => {
    setMutationResult(null);
    selectedAppRef.current = app;
    setSelectedApp(app);
    setEvalDialogOpen(true);
  };

  const filteredApplications =
    filterJobId === "all"
      ? applications
      : applications?.filter((app: any) => app.job_id === filterJobId);

  const getScoreColor = (score: number | null) => {
    if (score == null) return "bg-slate-100 text-slate-500 border-slate-200";
    if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
    if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "hired":     return "bg-green-100 text-green-700 border-green-200";
      case "rejected":  return "bg-red-100 text-red-600 border-red-200";
      case "interviewing": return "bg-blue-100 text-blue-700 border-blue-200";
      default:          return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hiring Pipeline"
        description="Automated candidate ranking and AI insights for your job openings."
      />

      {/* ── Toolbar ── */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Select value={filterJobId} onValueChange={setFilterJobId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs?.map((j: any) => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredApplications?.length || 0} total applications
          </span>
        </div>

        <div className="flex gap-2">
          {/* ── Manage Jobs Dialog ── */}
          <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Manage Jobs
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Active Job Postings</DialogTitle>
                <DialogDescription>View and manage your open positions.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4 max-h-[400px] overflow-y-auto pr-2">
                {jobs?.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-900">{job.title}</h4>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        {job.departments?.name || "No Department"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Delete this job? All applications will be removed.")) {
                          deleteJobMutation.mutate(job.id);
                        }
                      }}
                      disabled={deleteJobMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                {(!jobs || jobs.length === 0) && (
                  <div className="text-center py-8 text-slate-500">No jobs posted yet.</div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Create Job Dialog ── */}
          <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => { setEditingJob(null); setSelectedDept(""); }}
              >
                <Plus className="h-4 w-4" />
                Create New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingJob ? "Edit Job" : "Post New Job"}</DialogTitle>
                <DialogDescription>
                  Define the role requirements for the AI to match candidates.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  jobMutation.mutate({
                    title: f.get("title"),
                    description: f.get("description"),
                    experience_required: parseInt(f.get("experience") as string),
                    required_skills: (f.get("skills") as string)
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s !== ""),
                    department_id: selectedDept || null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input name="title" defaultValue={editingJob?.title} placeholder="e.g. Senior Frontend Engineer" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments?.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min. Experience (Years)</Label>
                    <Input name="experience" type="number" defaultValue={editingJob?.experience_required} placeholder="2" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Required Skills (comma separated)</Label>
                  <Input name="skills" placeholder="Python, SQL, AWS" defaultValue={editingJob?.required_skills?.join(", ")} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" defaultValue={editingJob?.description} placeholder="Describe the role..." rows={4} required />
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setIsJobDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={jobMutation.isPending}>
                    {jobMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>
                    ) : (
                      editingJob ? "Update Job" : "Post Job"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Applications Table ── */}
      <Card className="overflow-hidden border-slate-200 shadow-elegant">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[250px]">Candidate</TableHead>
              <TableHead>Applied For</TableHead>
              <TableHead className="text-center">Match Score</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-16 animate-pulse bg-slate-50/20" />
                </TableRow>
              ))
            ) : filteredApplications?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No applications found.
                </TableCell>
              </TableRow>
            ) : (
              filteredApplications?.map((app) => (
                <TableRow key={app.id} className="group hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="font-medium">{app.candidates?.name}</div>
                    <div className="text-xs text-muted-foreground">{app.candidates?.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal border-slate-200">
                      {app.jobs?.title}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("px-2 py-0.5 border font-semibold", getScoreColor(app.match_score))}>
                      {app.match_score != null ? `${Math.round(app.match_score)}%` : "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("capitalize border font-medium", getStatusBadgeClass(app.status))}>
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{app.parsed_data?.experience_years ?? "—"} yrs</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Button opens the SINGLE lifted Dialog below, not a per-row dialog */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 group-hover:bg-white"
                      onClick={() => openEvalDialog(app)}
                    >
                      View Insights
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── SINGLE Evaluation Dialog (lifted out of .map()) ── */}
      <Dialog
        open={evalDialogOpen}
        onOpenChange={(open) => {
          setEvalDialogOpen(open);
          if (!open) {
            // Brief delay so dialog animates out before clearing data
            setTimeout(() => {
              setSelectedApp(null);
              selectedAppRef.current = null;
              setMutationResult(null);
            }, 200);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Candidate Evaluation</DialogTitle>
            <DialogDescription>
              AI-generated analysis for{" "}
              <strong>{selectedApp?.candidates?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="grid gap-5 py-2">
              {/* Score + CV Row */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Overall Match Score</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {selectedApp.match_score != null
                      ? `${Math.round(selectedApp.match_score)}%`
                      : "N/A"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={cn("capitalize border font-medium text-sm px-3 py-1", getStatusBadgeClass(selectedApp.status))}>
                    {selectedApp.status}
                  </Badge>
                  {selectedApp.candidates?.cv_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedApp.candidates.cv_url} target="_blank" rel="noreferrer" className="gap-2">
                        <FileText className="h-4 w-4" />
                        View CV
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Strengths + Missing Skills */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 p-4 border rounded-xl bg-green-50/30 border-green-100">
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Strengths
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedApp.ai_evaluation?.strengths || "No data available."}
                  </p>
                </div>
                <div className="space-y-3 p-4 border rounded-xl bg-amber-50/30 border-amber-100">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    Missing Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedApp.ai_evaluation?.missing_skills?.length > 0 ? (
                      selectedApp.ai_evaluation.missing_skills.map((s: string) => (
                        <Badge key={s} variant="outline" className="bg-white/50">{s}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">None identified.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="space-y-3 p-5 border rounded-xl bg-blue-50/30 border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 font-semibold">
                  <Award className="h-4 w-4" />
                  AI Recommendation
                </div>
                <p className="text-sm italic text-slate-800 leading-relaxed">
                  "{selectedApp.ai_evaluation?.recommendation || "No recommendation available."}"
                </p>
              </div>

              {/* DB Mutation Result Banner */}
              {mutationResult && (
                <div
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border text-sm font-medium",
                    mutationResult.type === "success"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  )}
                >
                  <Database className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{mutationResult.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  disabled={statusMutation.isPending || selectedApp.status === "rejected"}
                  onClick={() =>
                    statusMutation.mutate({ appId: selectedApp.id, status: "rejected" })
                  }
                >
                  {statusMutation.isPending && statusMutation.variables?.status === "rejected" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                  Reject Candidate
                </Button>
                <Button
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  disabled={statusMutation.isPending || selectedApp.status === "hired"}
                  onClick={() =>
                    statusMutation.mutate({ appId: selectedApp.id, status: "hired" })
                  }
                >
                  {statusMutation.isPending && statusMutation.variables?.status === "hired" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4" />
                  )}
                  Hire Candidate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
