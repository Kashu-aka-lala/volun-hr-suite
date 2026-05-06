import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function Pending() {
  const { signOut, refresh, status } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <Card className="p-8 max-w-md text-center space-y-4 shadow-card">
        <div className="mx-auto h-14 w-14 rounded-full bg-warning/10 flex items-center justify-center">
          <Clock className="h-7 w-7 text-warning" />
        </div>
        <h2 className="text-2xl font-semibold">
          {status === "rejected" ? "Account rejected" : "Awaiting approval"}
        </h2>
        <p className="text-muted-foreground">
          {status === "rejected"
            ? "Your account access was rejected. Contact your administrator."
            : "Your account is pending admin approval. You'll get access once approved."}
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={refresh}>Check status</Button>
          <Button variant="ghost" onClick={signOut}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}
