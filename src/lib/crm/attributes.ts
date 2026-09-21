import { AI_LIMITS, truncate } from "@/lib/ai/limits";
import type { Database } from "@/lib/supabase/database.types";

export type ContactAttribute =
  Database["public"]["Tables"]["contact_attributes"]["Row"];

export function slugifyAttributeKey(label: string) {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .replace(/^(\d)/, "f_$1")
      .slice(0, 48) || "campo"
  );
}

/** Serializa campos para injetar no prompt da IA. */
export function buildAttributePromptBlock(
  attributes: ContactAttribute[],
  currentValues: Record<string, string | null>,
  contactProfile?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
  },
) {
  const collectable = attributes.filter((a) => a.collect_via_ai);

  const profileLines = [
    contactProfile?.name?.trim()
      ? `nome="${contactProfile.name.trim()}"`
      : null,
    contactProfile?.phone?.trim()
      ? `whatsapp="${contactProfile.phone.trim()}"`
      : null,
    contactProfile?.email?.trim()
      ? `email="${contactProfile.email.trim()}"`
      : null,
    contactProfile?.company?.trim()
      ? `empresa="${contactProfile.company.trim()}"`
      : null,
  ].filter(Boolean);

  const knownAttrs = collectable.filter((a) =>
    (currentValues[a.key] ?? "").trim(),
  );
  const pendingAttrs = collectable.filter(
    (a) => !(currentValues[a.key] ?? "").trim(),
  );

  const knownLines = knownAttrs.map(
    (a) => `- ${a.key} (${a.label}): "${(currentValues[a.key] ?? "").trim()}"`,
  );

  const pendingLines = pendingAttrs.map((a) => {
    const req = a.required ? " (obrigatório)" : "";
    return `- ${a.key} (${a.label}${req}, tipo ${a.type}): PENDENTE`;
  });

  const parts: string[] = [];

  if (profileLines.length > 0 || knownLines.length > 0) {
    parts.push(
      `DADOS JÁ NA BASE (proibido perguntar de novo — use direto):\n${[
        ...profileLines.map((l) => `- ${l}`),
        ...knownLines,
      ].join("\n")}`,
    );
  }

  if (collectable.length === 0 && parts.length === 0) return "";

  if (pendingLines.length === 0) {
    parts.push(
      "CAMPOS: nenhum pendente. NÃO peça nome, e-mail, empresa nem outros dados. Continue o atendimento com o que já sabe.",
    );
  } else {
    parts.push(
      `SÓ PERGUNTE ESTES (ainda faltam):\n${pendingLines.join("\n")}\nAo receber, inclua "collected":{key:valor} no JSON. Nunca peça um campo que já está em DADOS JÁ NA BASE.`,
    );
  }

  return truncate(parts.join("\n\n"), AI_LIMITS.attributeBlock);
}

/** Preenche currentValues a partir das colunas do contato quando o atributo ainda está vazio. */
export function hydrateAttributeValuesFromContact(
  attributes: ContactAttribute[],
  currentValues: Record<string, string | null>,
  contact: {
    display_name?: string | null;
    email?: string | null;
    company_name?: string | null;
  },
) {
  const fill = (keys: string[], value: string | null | undefined) => {
    const v = value?.trim();
    if (!v) return;
    for (const key of keys) {
      if (!attributes.some((a) => a.key === key)) continue;
      if ((currentValues[key] ?? "").trim()) continue;
      currentValues[key] = v;
    }
  };

  fill(["email"], contact.email);
  fill(["empresa", "company", "company_name"], contact.company_name);
  fill(["responsavel", "nome"], contact.display_name);
}
