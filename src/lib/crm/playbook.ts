import { AI_LIMITS, truncate } from "@/lib/ai/limits";

/** Template padrão — genérico para qualquer B2B. */
export const DEFAULT_PLAYBOOK_CONTENT = `# Objetivo
Qualificar o lead, entender a necessidade, coletar dados e apresentar um orçamento claro — como um consultor comercial humano, sem parecer formulário robótico.

# Tom de voz
Português do Brasil, cordial, objetivo. Mensagens curtas (WhatsApp). Uma pergunta por vez quando estiver coletando dados.

# Abertura
Cumprimente, apresente-se pela empresa e pergunte como pode ajudar.
Se o lead já disser o que quer (orçamento, informação, suporte), vá direto ao ponto.

# Dados a coletar
Use os CAMPOS A COLETAR injetados pelo sistema. Priorize os obrigatórios.
Não peça tudo de uma vez — converse naturalmente.
Quando o lead informar um dado, registre em "collected" no JSON.

# Diagnóstico
Depois dos dados básicos, faça perguntas curtas para entender:
- O que a pessoa precisa resolver agora
- Urgência (hoje / esta semana / só pesquisando)
- Se já usa algum fornecedor/concorrente
Adapte as perguntas ao ramo/setor informado — não use checklist genérico demais.

# Orçamento
Só precifique quando tiver a quantidade (ou o campo de porte) e souber quais serviços se aplicam.
Use EXCLUSIVAMENTE o CATÁLOGO / ORÇAMENTO PRÉ-CALCULADO do sistema.
Nunca invente preços.
Apresente a proposta de forma clara, separe o que é recorrente do que é avulso, e pergunte se quer ajustar.

# Objeções
Se disser que está caro: não entre em defensiva. Ofereça revisar o escopo (o essencial agora vs. depois).
Se pedir desconto especial ou negociação fora da tabela: transfira para humano (handoff).

# Fechamento
Confirme resumo (empresa, responsável, serviços, valor) e pergunte se pode seguir para contratação.
Se confirmar: agradeça, diga que a equipe dará sequência e faça handoff se necessário.

# Transferir para humano quando
- Cliente pedir atendente/humano explicitamente
- Pedir desconto ou condição especial
- Empresa muito grande / caso complexo
- Reclamação, fiscalização, urgência crítica
- Dúvida técnica que você não consegue responder com as instruções

# O que NÃO fazer
- Não inventar produtos, prazos ou preços
- Não insistir se o lead disser que não tem interesse
- Não enviar menus numerados longos sem necessidade
`;

export type PlaybookTrigger = "new_contact" | "keyword" | "manual";

export type Playbook = {
  id: string;
  name: string;
  trigger: PlaybookTrigger;
  trigger_keyword: string | null;
  is_active: boolean;
  content: string;
};

/** Extrai seções # Título do markdown do playbook. */
export function parsePlaybookSections(content: string) {
  const sections: { title: string; body: string }[] = [];
  const parts = content.split(/^# /m).filter(Boolean);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : part.slice(nl + 1)).trim();
    if (title) sections.push({ title, body });
  }
  return sections;
}

export function serializePlaybookSections(
  sections: { title: string; body: string }[],
) {
  return sections
    .map((s) => `# ${s.title}\n${s.body.trim()}`.trim())
    .join("\n\n");
}

/** Seções canônicas da UI (ordem do editor). */
export const PLAYBOOK_SECTION_ORDER = [
  "Objetivo",
  "Tom de voz",
  "Abertura",
  "Diagnóstico",
  "Orçamento",
  "Objeções",
  "Fechamento",
  "Transferência",
  "Limites",
] as const;

const SECTION_ALIASES: Record<string, string> = {
  "Transferir para humano quando": "Transferência",
  "O que NÃO fazer": "Limites",
  "Dados a coletar": "Diagnóstico",
};

export function normalizePlaybookSections(content: string) {
  const parsed = parsePlaybookSections(content).map((s) => ({
    title: SECTION_ALIASES[s.title] ?? s.title,
    body: s.body,
  }));
  const byTitle = new Map<string, string>();
  for (const s of parsed) {
    const prev = byTitle.get(s.title);
    byTitle.set(s.title, prev ? `${prev}\n${s.body}`.trim() : s.body);
  }
  const ordered: { title: string; body: string }[] = PLAYBOOK_SECTION_ORDER.map(
    (title) => ({
      title,
      body: byTitle.get(title) ?? "",
    }),
  );
  for (const [title, body] of byTitle) {
    if (
      !PLAYBOOK_SECTION_ORDER.includes(
        title as (typeof PLAYBOOK_SECTION_ORDER)[number],
      )
    ) {
      ordered.push({ title, body });
    }
  }
  return ordered;
}

export function buildPlaybookPromptBlock(playbook: Playbook | null) {
  if (!playbook?.is_active || !playbook.content.trim()) return "";
  const content = truncate(playbook.content.trim(), AI_LIMITS.playbook);
  return `ROTEIRO ("${playbook.name}"):\n${content}`;
}

/** Escolhe o playbook ativo: keyword match primeiro, depois new_contact. */
export function pickActivePlaybook(
  playbooks: Playbook[],
  latestUserMessage: string,
): Playbook | null {
  const active = playbooks.filter((p) => p.is_active);
  if (active.length === 0) return null;

  const msg = latestUserMessage.toLowerCase();
  const byKeyword = active.find(
    (p) =>
      p.trigger === "keyword" &&
      p.trigger_keyword &&
      msg.includes(p.trigger_keyword.toLowerCase()),
  );
  if (byKeyword) return byKeyword;

  return (
    active.find((p) => p.trigger === "new_contact") ??
    active.find((p) => p.trigger === "manual") ??
    active[0] ??
    null
  );
}
