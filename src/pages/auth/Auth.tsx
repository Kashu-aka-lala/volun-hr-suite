import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signIn(String(f.get("email")), String(f.get("password")));
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Welcome back");
    nav("/");
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signUp(String(f.get("email")), String(f.get("password")), String(f.get("name")));
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Account created — pending admin approval");
    nav("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-elegant overflow-hidden">
            <img src="/favicon.ico" alt="DeVerse Logo" className="h-full w-full object-contain p-2" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">DeVerse IT Solutions</h1>
          <p className="text-muted-foreground text-sm">Modern HR management, beautifully simple</p>
        </div>
        <Card className="p-6 shadow-card">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                <div className="space-y-2"><Label>Password</Label><Input name="password" type="password" required minLength={6} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input name="name" required /></div>
                <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                <div className="space-y-2"><Label>Password</Label><Input name="password" type="password" required minLength={6} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
                <p className="text-xs text-muted-foreground text-center">First user becomes admin automatically.</p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
