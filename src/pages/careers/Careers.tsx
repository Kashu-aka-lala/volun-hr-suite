import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Briefcase, MapPin, Clock } from "lucide-react";

export default function Careers() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, departments(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Join DeVerse IT Solutions</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Build the future of HR tech with us. We're looking for passionate individuals to join our growing team.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-48 animate-pulse bg-white/50" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {jobs?.map((job) => (
              <Card key={job.id} className="p-6 hover:shadow-lg transition-shadow border-slate-200">
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3">
                        {job.departments?.name || "General"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{job.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.required_skills.slice(0, 3).map((skill: string) => (
                        <Badge key={skill} variant="outline" className="font-normal">
                          {skill}
                        </Badge>
                      ))}
                      {job.required_skills.length > 3 && (
                        <span className="text-xs text-muted-foreground pt-1">+{job.required_skills.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {job.experience_required}+ yrs
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Remote
                      </span>
                    </div>
                    <Button asChild size="sm">
                      <Link to={`/apply/${job.id}`}>Apply Now</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
