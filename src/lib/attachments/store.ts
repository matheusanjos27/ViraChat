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

/** Statically scoped default — keeps Turbopack from tracing the whole project. */
const DEFAULT_ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");

export function attachmentsRoot() {
  return process.env.ATTACHMENTS_DIR?.trim() || DEFAULT_ATTACHMENTS_DIR;
}

function resolveUnderRoot(root: string, ...parts: string[]) {
  const abs = path.join(/*turbopackIgnore: true*/ root, ...parts);
  const resolvedRoot = path.resolve(/*turbopackIgnore: true*/ root);
  const resolved = path.resolve(/*turbopackIgnore: true*/ abs);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new Error("Caminho de anexo inválido");
  }
  return resolved;
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
    .replace(/^\.+/, "_")
    .slice(0, 120) || "arquivo";
  const rel = `${params.tenantId}/${id}-${safeName}`;
  const root = attachmentsRoot();
  const dir = resolveUnderRoot(root, params.tenantId);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolveUnderRoot(root, params.tenantId, `${id}-${safeName}`),
      params.bytes,
    );
  } catch (err) {
    const e = err as Error & { code?: string };
    const wrapped = new Error(
      `Não foi possível gravar anexo em ${root}: ${e.message}`,
    ) as Error & { code?: string };
    wrapped.code = e.code;
    throw wrapped;
  }
  return { storageKey: rel, sizeBytes: params.bytes.length };
}

export async function readAttachmentBytes(storageKey: string) {
  return readFile(resolveUnderRoot(attachmentsRoot(), storageKey));
}

export function decodeBase64Payload(raw: string) {
  const cleaned = raw
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s+/g, "")
    .trim();
  return Buffer.from(cleaned, "base64");
}
