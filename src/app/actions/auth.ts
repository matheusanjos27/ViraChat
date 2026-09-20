"use server";

import { redirect } from "next/navigation";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
};

function formatAuthError(message: string) {
  if (/fetch failed/i.test(message)) {
    return "Não foi possível conectar ao Supabase. Confira NEXT_PUBLIC_SUPABASE_URL no .env e reinicie o npm run dev.";
  }
  return message;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  if (await isCurrentUserPlatformAdmin()) {
    redirect("/platform");
  }

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (password !== confirm) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  if (await isCurrentUserPlatformAdmin()) {
    redirect("/platform");
  }

  redirect("/app");
}
