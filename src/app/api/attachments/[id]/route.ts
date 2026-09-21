import { NextResponse } from "next/server";
import { readAttachmentBytes } from "@/lib/attachments/store";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = createServiceClient();
  const { data: file, error } = await admin
    .from("message_attachments")
    .select(
      "id, tenant_id, file_name, mime_type, storage_key, status, size_bytes",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !file) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("user_tenant_roles")
    .select("id")
    .eq("tenant_id", file.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: platform } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership && !platform) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (file.status !== "stored" || !file.storage_key) {
    return NextResponse.json(
      { error: "Arquivo indisponível para download" },
      { status: 404 },
    );
  }

  try {
    const bytes = await readAttachmentBytes(file.storage_key);
    const name = file.file_name || "anexo";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Falha ao ler arquivo" }, { status: 500 });
  }
}
