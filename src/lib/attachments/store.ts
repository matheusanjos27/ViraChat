import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  attachmentMaxBytes,
  formatBytes,
} from "@/lib/attachments/format";

export {
  attachmentMaxBytes,
  formatBytes,
  kindFromMime,
  type AttachmentKind,
} from "@/lib/attachments/format";

export function attachmentsRoot() {
  return (
    process.env.ATTACHMENTS_DIR?.trim() ||
    path.join(process.cwd(), "data", "attachments")
  );
}

export async function saveAttachmentBytes(params: {
  tenantId: string;
  bytes: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<{ storageKey: string; sizeBytes: number }> {
  const max = attachmentMaxBytes();
  if (params.bytes.length > max) {
    const err = new Error(`Arquivo acima do limite de ${formatBytes(max)}`);
    (err as Error & { code?: string }).code = "TOO_LARGE";
    throw err;
  }

  const id = randomUUID();
  const safeName = (params.fileName ?? "arquivo")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .slice(0, 120);
  const rel = path.posix.join(params.tenantId, `${id}-${safeName}`);
  const abs = path.join(attachmentsRoot(), params.tenantId);
  await mkdir(abs, { recursive: true });
  await writeFile(path.join(attachmentsRoot(), rel), params.bytes);
  return { storageKey: rel, sizeBytes: params.bytes.length };
}

export async function readAttachmentBytes(storageKey: string) {
  const abs = path.join(attachmentsRoot(), storageKey);
  const root = path.resolve(attachmentsRoot());
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(root)) {
    throw new Error("Caminho de anexo inválido");
  }
  return readFile(resolved);
}

export function decodeBase64Payload(raw: string) {
  const cleaned = raw.replace(/^data:[^;]+;base64,/, "").trim();
  return Buffer.from(cleaned, "base64");
}
