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
) {
  const collectable = attributes.filter((a) => a.collect_via_ai);
  if (collectable.length === 0) return "";

  const lines = collectable.map((a) => {
    const current = currentValues[a.key];
    const status = current ? `já coletado: "${current}"` : "PENDENTE";
    const req = a.required ? " (obrigatório)" : "";
    return `- ${a.key} (${a.label}${req}, tipo ${a.type}): ${status}`;
  });

  return truncate(
    `
CAMPOS A COLETAR DO CONTATO (preencha naturalmente na conversa, sem parecer formulário):
${lines.join("\n")}

Quando o cliente informar um valor, inclua no JSON de resposta a chave "collected" com os pares key→valor NA MESMA resposta.
Exemplo: {"action":"reply","text":"...","collected":{"empresa":"Acme Ltda","tamanho":"25","email":"a@b.com"}}
Só inclua campos que realmente foram confirmados nesta conversa. Não invente dados.
Se o cliente já informou vários campos numa mensagem, devolva todos eles em "collected" de uma vez.
`.trim(),
    AI_LIMITS.attributeBlock,
  );
}
