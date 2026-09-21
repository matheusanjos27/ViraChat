export type AttachmentKind =
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "other";

export function attachmentMaxBytes() {
  const mb = Number.parseFloat(
    typeof process !== "undefined"
      ? (process.env.ATTACHMENT_MAX_MB ?? "10")
      : "10",
  );
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 50) : 10;
  return Math.round(safe * 1024 * 1024);
}

export function kindFromMime(
  mime: string | null | undefined,
  hint?: string,
): AttachmentKind {
  const m = (mime ?? "").toLowerCase();
  const h = (hint ?? "").toLowerCase();
  if (m.startsWith("image/") || h.includes("image") || h.includes("sticker")) {
    if (h.includes("sticker") || m.includes("webp")) return "sticker";
    return "image";
  }
  if (m.startsWith("audio/") || h.includes("audio") || h.includes("ptt")) {
    return "audio";
  }
  if (m.startsWith("video/") || h.includes("video")) return "video";
  if (
    m.includes("pdf") ||
    m.includes("officedocument") ||
    m.includes("msword") ||
    h.includes("document")
  ) {
    return "document";
  }
  return "other";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
