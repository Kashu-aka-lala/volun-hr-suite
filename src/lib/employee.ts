import { supabase } from "@/integrations/supabase/client";

export async function getMyEmployee(userId: string) {
  const { data, error } = await supabase
    .from("employees").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
