import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const createSupabaseBrowserClient = () => {
  // Nutzt automatisch die NEXT_PUBLIC_SUPABASE_* Variablen
  return createClientComponentClient();
};


