import { redirect } from "next/navigation";

// Le proxy redirige déjà ; ce repli couvre l'accès direct sans proxy.
export default function Home() {
  redirect("/dashboard");
}
