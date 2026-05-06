import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function Apply() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      setIsUploading(true);
      
      // 1. Upload CV to Supabase Storage
      const fileExt = file!.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `cvs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("cv_storage")
        .upload(filePath, file!);

      if (uploadError) throw new Error("Failed to upload CV");

      const { data: { publicUrl } } = supabase.storage
        .from("cv_storage")
        .getPublicUrl(filePath);

      // 2. Convert file to Base64 for the Edge Function
      const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result?.toString().split(',')[1] || "");
        reader.onerror = reject;
      });

      const fileBase64 = await toBase64(file!);

      // 3. Trigger AI Parsing and Matching via Supabase Edge Function
      const { data: processedData, error: edgeError } = await supabase.functions.invoke('process-cv', {
        body: {
          fileBase64,
          jobData: {
            title: job!.title,
            required_skills: job!.required_skills,
            experience_required: job!.experience_required,
          },
        },
      });

      if (edgeError) {
        console.error("Edge Function Error Details:", edgeError);
        throw new Error(`AI Processing failed: ${edgeError.message || 'Unknown'}`);
      }

      if (processedData?.error) {
        throw new Error(`${processedData.error}: ${processedData.details || ''}`);
      }

      // 4. Save to Database
      const { data: candidate, error: candError } = await supabase
        .from("candidates")
        .insert({
          name: formData.name,
          email: formData.email,
          cv_url: publicUrl,
        })
        .select()
        .single();

      if (candError) throw candError;

      const { error: appError } = await supabase
        .from("applications")
        .insert({
          candidate_id: candidate.id,
          job_id: jobId,
          parsed_data: {
            skills: processedData.skills,
            experience_years: processedData.experience_years,
            education: processedData.education,
            projects: processedData.projects,
          },
          match_score: processedData.score,
          ai_evaluation: processedData.insights,
        });

      if (appError) throw appError;
      
      return true;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application submitted successfully!");
      setIsUploading(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit application");
      setIsUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return toast.error("Please upload your CV");
    const formData = new FormData(e.currentTarget);
    submitMutation.mutate({
      name: formData.get("name"),
      email: formData.get("email"),
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Application Received!</h2>
            <p className="text-muted-foreground">
              Thank you for applying for the <strong>{job?.title}</strong> position. Our team will review your profile and get back to you soon.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate("/careers")}>
            Back to Careers
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/careers")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Apply for {job?.title}</h1>
          <p className="text-muted-foreground">{job?.departments?.name} • Remote</p>
        </div>

        <Card className="p-8 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="john@example.com" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resume / CV (PDF)</Label>
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50"
                }`}
                onClick={() => document.getElementById("cv-upload")?.click()}
              >
                <input
                  id="cv-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`h-8 w-8 ${file ? "text-primary" : "text-slate-400"}`} />
                  {file ? (
                    <span className="font-medium text-primary">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload or drag and drop</span>
                      <span className="text-xs text-muted-foreground">PDF (max. 5MB)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full h-11" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Application...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
