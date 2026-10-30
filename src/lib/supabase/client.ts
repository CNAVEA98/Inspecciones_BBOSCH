import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Las variables NEXT_PUBLIC_* se reemplazan en el build, por eso se leen directo aquí.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
