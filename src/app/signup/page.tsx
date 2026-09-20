import { redirect } from "next/navigation";

/** Cadastro público removido — só convite do super admin. */
export default function SignupPage() {
  redirect("/login");
}
