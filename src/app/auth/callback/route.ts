import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/app/conversations";

  const supabase = await createClient();

  // Fluxo de convite: token_hash + type=invite
  if (tokenHash && type === "invite") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });
    if (!error) {
      // Redireciona para o usuário criar a senha
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
    return NextResponse.redirect(`${origin}/login?error=invite`);
  }

  // Fluxo de recuperação de senha: token_hash + type=recovery
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
    return NextResponse.redirect(`${origin}/login?error=recovery`);
  }

  // Fluxo PKCE com code (OAuth / magic link)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
