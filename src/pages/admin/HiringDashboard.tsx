import { useState } from "react";
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
import { FileText, Award, AlertCircle, CheckCircle2, ChevronRight, Filter, Plus, Briefcase, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";

export default function HiringDashboard() {
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [filterJobId, setFilterJobId] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          jobs(title, required_skills),
          candidates(name, email, cv_url)
        `)
        .order("match_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*, departments(name)");
      if (error) throw error;
      return data;
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

  const statusMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      window.alert(`Attempting DB Update: ID=${appId} -> Status=${status}`);
      const { data, error, count } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", appId)
        .select(); // select() forces it to return data so we can check count
      
      if (error) throw error;
      
      const rowsAffected = data?.length || 0;
      window.alert(`Database Response: Rows affected = ${rowsAffected}`);
      
      if (rowsAffected === 0) {
        throw new Error("The database couldn't find this candidate's ID to update.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast.success("Candidate status updated!");
      window.alert("SUCCESS: The database confirmed the update!");
    },
    onError: (err: any) => {
      console.error("FULL DATABASE ERROR:", err);
      window.alert("DATABASE ERROR: " + (err.message || JSON.stringify(err)));
      toast.error(`Database Error: ${err.message || 'Check your permissions'}`);
    }
  });

  const jobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      if (editingJob) {
        const { error } = await supabase
          .from("jobs")
          .update(jobData)
          .eq("id", editingJob.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jobs").insert(jobData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(editingJob ? "Job updated" : "Job created");
      setIsJobDialogOpen(false);
      setEditingJob(null);
      setSelectedDept("");
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job posting deleted");
    },
    onError: (err: any) => {
      toast.error(`Error deleting job: ${err.message}`);
    }
  });

  const filteredApplications = filterJobId === "all" 
    ? applications 
    : applications?.filter((app: any) => app.job_id === filterJobId);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
    if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Hiring Pipeline" 
        description="Automated candidate ranking and AI insights for your job openings." 
      />

      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
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
          <span className="text-sm text-muted-foreground">{filteredApplications?.length || 0} total applications</span>
        </div>
        <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={() => {
              setEditingJob(null);
              setSelectedDept("");
            }}>
              <Plus className="h-4 w-4" />
              Create New Job
            </Button>
          </DialogTrigger>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 ml-2">
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
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-semibold text-slate-900">{job.title}</h4>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{job.departments?.name || 'No Department'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this job? All associated applications will be removed.")) {
                            deleteJobMutation.mutate(job.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {(!jobs || jobs.length === 0) && (
                  <div className="text-center py-8 text-slate-500">No jobs posted yet.</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingJob ? "Edit Job" : "Post New Job"}</DialogTitle>
              <DialogDescription>Define the role requirements for the AI to match candidates.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4 pt-4" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const jobData = {
                title: f.get("title"),
                description: f.get("description"),
                experience_required: parseInt(f.get("experience") as string),
                required_skills: (f.get("skills") as string).split(",").map(s => s.trim()).filter(s => s !== ""),
                department_id: selectedDept || null,
              };
              console.log("Submitting Job Data:", jobData);
              jobMutation.mutate(jobData);
            }}>
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
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsJobDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={jobMutation.isPending}>
                  {jobMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    editingJob ? "Update Job" : "Post Job"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableCell colSpan={5} className="h-16 animate-pulse bg-slate-50/20" />
                </TableRow>
              ))
            ) : filteredApplications?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
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
                      {Math.round(app.match_score)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="capitalize">
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{app.parsed_data?.experience_years || 0} years</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2 group-hover:bg-white" onClick={() => setSelectedApp(app)}>
                          View Insights
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">Candidate Evaluation</DialogTitle>
                          <DialogDescription>
                            AI-generated analysis for {selectedApp?.candidates?.name}
                          </DialogDescription>
                        </DialogHeader>

                        {selectedApp && (
                          <div className="grid gap-6 py-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Overall Match Score</p>
                                <p className="text-3xl font-bold text-slate-900">{Math.round(selectedApp.match_score)}%</p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <a href={selectedApp.candidates?.cv_url} target="_blank" rel="noreferrer" className="gap-2">
                                    <FileText className="h-4 w-4" />
                                    View CV
                                  </a>
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-3 p-4 border rounded-xl bg-green-50/30 border-green-100">
                                <div className="flex items-center gap-2 text-green-700 font-semibold">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Strengths
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {selectedApp.ai_evaluation?.strengths}
                                </p>
                              </div>
                              <div className="space-y-3 p-4 border rounded-xl bg-amber-50/30 border-amber-100">
                                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                                  <AlertCircle className="h-4 w-4" />
                                  Missing Skills
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {selectedApp.ai_evaluation?.missing_skills?.map((s: string) => (
                                    <Badge key={s} variant="outline" className="bg-white/50">{s}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 p-5 border rounded-xl bg-blue-50/30 border-blue-100">
                              <div className="flex items-center gap-2 text-blue-700 font-semibold">
                                <Award className="h-4 w-4" />
                                AI Recommendation
                              </div>
                              <p className="text-sm italic text-slate-800 leading-relaxed">
                                "{selectedApp.ai_evaluation?.recommendation}"
                              </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                              <Button 
                                variant="destructive" 
                                className="flex-1 gap-2" 
                                disabled={statusMutation.isPending}
                                onClick={() => {
                                  window.alert("REJECT BUTTON CLICKED");
                                  statusMutation.mutate({ appId: selectedApp.id, status: "rejected" });
                                }}
                              >
                                <ThumbsDown className="h-4 w-4" />
                                Reject Candidate
                              </Button>
                              <Button 
                                className="flex-1 gap-2 bg-green-600 hover:bg-green-700" 
                                disabled={statusMutation.isPending}
                                onClick={() => {
                                  window.alert("HIRE BUTTON CLICKED");
                                  statusMutation.mutate({ appId: selectedApp.id, status: "hired" });
                                }}
                              >
                                <ThumbsUp className="h-4 w-4" />
                                Hire Candidate
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
