/** Template padrão — genérico para qualquer B2B. */
export const DEFAULT_PLAYBOOK_CONTENT = `# Objetivo
Atender como consultor comercial humano. Funil: conversar → coletar dados → orçar → cliente decide → humano (se aceitar) ou encerrar (se recusar).

# Tom de voz
Português do Brasil, cordial, objetivo. Mensagens curtas (WhatsApp).

# Abertura
Cumprimente, apresente-se pela empresa e pergunte como pode ajudar.
Se o lead já disser o que quer (orçamento, informação, suporte), vá direto ao ponto — sem tabela de preços ainda.

# Coleta de dados
ANTES de pedir qualquer campo: confirme o consentimento LGPD (o sistema também exige isso).
Explique que os dados servem só para orçamento e atendimento comercial; peça *sim* ou *não*.
Só depois do sim: use os CAMPOS injetados ("SÓ PERGUNTE ESTES").
Nunca peça o que já estiver em "DADOS JÁ NA BASE".
Formato: liste de uma vez os pendentes obrigatórios (com 1️⃣ 2️⃣ 3️⃣…) e peça que responda em uma mensagem.
Quando o lead informar, registre em "collected" no JSON.
Não mostre preços enquanto houver obrigatório pendente.
Se recusar a LGPD: não colete; ofereça humano ou encerre com cordialidade.

# Diagnóstico
Entenda o que a pessoa busca antes (ou junto) da coleta:
- O que precisa resolver agora
- Urgência (hoje / esta semana / só pesquisando)
- Se já usa algum fornecedor/concorrente
Adapte ao ramo/setor — sem checklist genérico demais.

# Orçamento
Só precifique com dados obrigatórios ok, quantidade/porte e itens do catálogo claros.
Use EXCLUSIVAMENTE o CATÁLOGO / ORÇAMENTO PRÉ-CALCULADO do sistema.
Nunca invente produtos, serviços ou preços.
Apresente a proposta com clareza e pergunte se faz sentido / se quer ajustar.
Aguarde a decisão — não transfira só por ter orçado.

# Objeções
Se disser que está caro: ofereça revisar o escopo (essencial agora vs. depois).
Se pedir desconto especial ou condição fora da tabela: transfira para humano.
Se não tiver interesse: agradeça e encerre sem insistir.

# Fechamento
Depois do orçamento, espere o cliente decidir.
- Aceitou (contratar / comprar / vou querer / aceito): confirme e o sistema oferece atendente para finalizar.
- Recusou ou só pesquisando: agradeça, deixe porta aberta e encerre — sem atendente.
Você NÃO fecha a venda sozinho. Não diga que a compra já foi fechada.

# Transferir para humano quando
- Cliente aceitou o orçamento / quer contratar, comprar ou fechar
- Cliente pedir atendente/humano explicitamente
- Pedir desconto ou condição especial
- Pedido fora do catálogo cadastrado
- Empresa muito grande / caso complexo
- Reclamação, fiscalização, urgência crítica
- Dúvida técnica que você não consegue responder com as instruções

# O que NÃO fazer
- Não inventar produtos, prazos ou preços fora do catálogo
- Não perguntar de novo dados já coletados
- Não inventar validação de e-mail (se tem @ e domínio, aceite)
- Não fechar compra/contrato sozinho
- Não oferecer atendente só porque coletou dados ou mostrou preço
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
  "Coleta de dados",
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
  "Dados a coletar": "Coleta de dados",
  Coleta: "Coleta de dados",
  Diagnostico: "Diagnóstico",
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
  // Sem segundo corte: o editor já limita em playbookSaved.
  const content = playbook.content.trim();
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
