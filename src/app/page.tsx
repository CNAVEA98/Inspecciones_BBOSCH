import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";

export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}
