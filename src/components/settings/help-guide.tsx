"use client";

import Link from "next/link";
import { useState } from "react";

const TABS = [
  { id: "inicio", label: "Começar" },
  { id: "atendimento", label: "Atendimento" },
  { id: "crm", label: "Leads e Funil" },
  { id: "ia", label: "IA" },
  { id: "equipe", label: "Equipe e Canais" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Step = { title: string; body: string; href?: string };

const START_STEPS: Step[] = [
  {
    title: "1. Complete os dados da empresa",
    body: "Em Configurações → Empresa, confira o nome e as informações básicas. Assim a equipe e a IA sabem com quem estão falando.",
    href: "/app/settings/company",
  },
  {
    title: "2. Conecte o WhatsApp",
    body: "Em Canais, conecte o número da empresa pelo QR Code no celular. Sem isso, as conversas não entram no painel.",
    href: "/app/channels",
  },
  {
    title: "3. Ensine a IA",
    body: "Em Atendimento com IA: defina o nome e o jeito de falar (Identidade), o roteiro (Playbook), o que perguntar (Campos) e o que vender (Produtos).",
    href: "/app/settings/ai",
  },
  {
    title: "4. Ligue a IA",
    body: "Na etapa Identidade, ative o assistente. Com isso ligado, a IA pode responder sozinha no WhatsApp.",
    href: "/app/settings/ai?tab=ligar",
  },
  {
    title: "5. Chame a equipe",
    body: "Em Equipe, cadastre quem vai atender: informe e-mail e uma senha temporária. No primeiro acesso a pessoa troca a senha.",
    href: "/app/settings/team",
  },
  {
    title: "6. Use no dia a dia",
    body: "Conversas para falar com clientes, Leads para a base de contatos e Funil para acompanhar vendas.",
    href: "/app/conversations",
  },
];

const ATTENDANCE_STEPS: Step[] = [
  {
    title: "Abrir as Conversas",
    body: "À esquerda ficam os chats; no centro, a conversa. Você pode filtrar por abertas, aguardando humano ou resolvidas.",
    href: "/app/conversations",
  },
  {
    title: "Quando a IA responde",
    body: "Com IA ligada e WhatsApp conectado, o cliente recebe respostas automáticas no celular — conforme o que você ensinou.",
  },
  {
    title: "Assumir o atendimento",
    body: "Se o cliente pedir uma pessoa, ou a conversa estiver “aguardando humano”, um atendente assume e continua pelo painel.",
  },
  {
    title: "Fotos e arquivos",
    body: "O que o cliente mandar no WhatsApp (foto, PDF etc.) aparece na conversa.",
  },
  {
    title: "Encerrar a conversa",
    body: "Quando terminar, marque como resolvida. Assim a fila fica limpa e o histórico permanece no lead.",
  },
];

const CRM_STEPS: Step[] = [
  {
    title: "Leads",
    body: "Cada pessoa que fala no WhatsApp vira um lead. Na lista você vê nome, telefone e pode abrir o chat na hora.",
    href: "/app/leads",
  },
  {
    title: "Informações do cliente",
    body: "Os campos que você criou na IA (cidade, orçamento, etc.) vão sendo preenchidos na conversa e ficam no cadastro do lead.",
    href: "/app/settings/ai?tab=campos",
  },
  {
    title: "Funil de vendas",
    body: "Cada oportunidade aparece em uma etapa (novo, proposta, fechado…). Avance conforme a venda anda.",
    href: "/app/deals",
  },
  {
    title: "Etapas do funil",
    body: "Em Configurações → Funil você monta as colunas do quadro (incluindo fechado e perdido).",
    href: "/app/settings/pipeline",
  },
];

const AI_STEPS: Step[] = [
  {
    title: "Identidade",
    body: "Nome do assistente e como ele deve falar. Use “Testar IA” para ver uma resposta de exemplo antes de liberar no WhatsApp.",
    href: "/app/settings/ai?tab=ligar",
  },
  {
    title: "Playbook",
    body: "O roteiro da conversa: saudação, perguntas, como tratar objeção e quando chamar um humano.",
    href: "/app/settings/ai?tab=roteiro",
  },
  {
    title: "Campos",
    body: "O que a IA deve perguntar e guardar (ex.: quantidade de pessoas, data do evento).",
    href: "/app/settings/ai?tab=campos",
  },
  {
    title: "Produtos",
    body: "Seus serviços e preços. Assim a IA orça com base no que você vende de verdade.",
    href: "/app/settings/ai?tab=catalogo",
  },
  {
    title: "Progresso",
    body: "No topo da Central de IA aparece o que ainda falta para a IA ficar pronta (nome, roteiro, produtos etc.).",
  },
];

const TEAM_STEPS: Step[] = [
  {
    title: "Quem faz o quê",
    body: "Administrador e supervisor configuram a empresa e a equipe. Atendente cuida de conversas, leads e funil.",
    href: "/app/settings/team",
  },
  {
    title: "Cadastrar alguém",
    body: "Informe e-mail, senha temporária e o papel. Passe esse login para a pessoa — no primeiro acesso ela troca a senha.",
  },
  {
    title: "Limite de usuários",
    body: "Cada empresa tem um máximo de pessoas. Se estiver cheio, entre em contato conosco para aumentar o limite do seu plano.",
  },
  {
    title: "WhatsApp",
    body: "Conecte pelo QR em Canais. Use o celular com o número da empresa. Só desconecte se for trocar de aparelho ou número.",
    href: "/app/channels",
  },
];

export function HelpGuide() {
  const [tab, setTab] = useState<TabId>("inicio");

  return (
    <div className="space-y-5">
      <nav aria-label="Seções da ajuda" className="space-y-2">
        <p className="text-xs text-ink-muted">
          Escolha um tema para ver o roteiro em etapas
        </p>
        <div
          role="tablist"
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`min-h-11 cursor-pointer rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? "border-brand bg-brand-soft text-brand-deep shadow-sm ring-1 ring-brand/30"
                    : "border-line bg-surface text-ink-muted hover:border-brand/40 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "inicio" ? (
        <GuideBlock
          title="Roteiro inicial"
          subtitle="Ordem sugerida para colocar a operação no ar."
          steps={START_STEPS}
        />
      ) : null}
      {tab === "atendimento" ? (
        <GuideBlock
          title="Atendimento no dia a dia"
          subtitle="Como usar a caixa de conversas e quando entrar na conversa."
          steps={ATTENDANCE_STEPS}
        />
      ) : null}
      {tab === "crm" ? (
        <GuideBlock
          title="Leads e Funil"
          subtitle="Do primeiro contato ao fechamento da venda."
          steps={CRM_STEPS}
        />
      ) : null}
      {tab === "ia" ? (
        <GuideBlock
          title="Central de treinamento da IA"
          subtitle="As quatro etapas que ensinam o assistente."
          steps={AI_STEPS}
        />
      ) : null}
      {tab === "equipe" ? (
        <GuideBlock
          title="Equipe e canais"
          subtitle="Quem entra no painel e como conectar o WhatsApp."
          steps={TEAM_STEPS}
        />
      ) : null}
    </div>
  );
}

function GuideBlock({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: Step[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
      </div>
      <ol className="divide-y divide-line">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 px-5 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand-deep">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                {step.body}
              </p>
              {step.href ? (
                <Link
                  href={step.href}
                  className="mt-2 inline-flex text-sm font-semibold text-brand hover:text-brand-deep"
                >
                  Abrir no sistema →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
