"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  ContactModal,
  useContactModal,
} from "@/components/marketing/contact-modal";

export function LandingPage() {
  const { open, openContact, closeContact } = useContactModal();

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#f4faf8] text-ink">
      <BgWaves />

      <header className="rise-in relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
        <a
          href="#inicio"
          className="flex items-center rounded-xl bg-sidebar px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:shadow-[0_10px_28px_rgba(15,23,42,0.22)] sm:rounded-2xl sm:px-4 sm:py-3"
        >
          <img
            src="/logo.png"
            alt="ViraChat"
            className="h-9 w-auto sm:h-14 md:h-16"
          />
        </a>
        <nav className="hidden items-center gap-7 text-sm text-ink-muted md:flex">
          <a
            href="#inicio"
            className="transition-colors hover:text-ink"
          >
            Início
          </a>
          <a
            href="#recursos"
            className="transition-colors hover:text-ink"
          >
            Recursos
          </a>
          <a
            href="#como-funciona"
            className="transition-colors hover:text-ink"
          >
            Como funciona
          </a>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:px-3"
          >
            Entrar
          </Link>
          <button
            type="button"
            onClick={openContact}
            className="rounded-full bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-deep hover:shadow-md active:scale-[0.98] sm:px-4"
          >
            Começar
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <section
          id="inicio"
          className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-4 sm:gap-10 sm:px-5 sm:pb-16 sm:pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-12"
        >
          <div className="land-stagger">
            <h1
              className="rise-in max-w-xl text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-4xl sm:leading-[1.12] md:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Atenda no WhatsApp com IA.{" "}
              <span className="text-brand">Sem perder o controle.</span>
            </h1>
            <p
              className="rise-in mt-4 max-w-lg text-[15px] leading-relaxed text-ink-body sm:mt-5 sm:text-base sm:text-ink-muted md:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              Sua IA responde automaticamente às mensagens, resolve o que for
              possível e o você assume quando quiser.
            </p>
            <div
              className="rise-in mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: "260ms" }}
            >
              <button
                type="button"
                onClick={openContact}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep hover:shadow-md active:scale-[0.98]"
              >
                Começar agora
                <span aria-hidden>→</span>
              </button>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-divider hover:shadow-sm active:scale-[0.98]"
              >
                Ver como funciona
              </a>
            </div>
          </div>

          <div
            className="rise-in hidden sm:block"
            style={{ animationDelay: "320ms" }}
          >
            <HeroMock />
          </div>
        </section>

        <Reveal>
          <section className="mx-auto grid max-w-6xl gap-5 border-t border-line px-4 py-10 sm:grid-cols-2 sm:gap-6 sm:px-5 sm:py-12 lg:grid-cols-4">
            {[
              {
                title: "IA 24h",
                body: "Responde a qualquer hora, todos os dias.",
              },
              {
                title: "Múltiplos números",
                body: "Conecte vários números de WhatsApp.",
              },
              {
                title: "Central de conversas",
                body: "Tudo em um só lugar, completo e organizado.",
              },
              {
                title: "Humano quando quiser",
                body: "Assuma o controle com um clique.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="live-dot mt-1 size-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </section>
        </Reveal>

        <Reveal>
          <section id="recursos" className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Recursos
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl md:text-4xl">
              Tudo em um <span className="text-brand">só lugar</span>
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "IA inteligente",
                  body: "Treine tom, roteiro, campos e produtos. A IA atende com a cara da sua empresa.",
                },
                {
                  title: "Múltiplos WhatsApps",
                  body: "Vários números conectados — vendas, suporte, financeiro — na mesma central.",
                },
                {
                  title: "Central de conversas",
                  body: "Inbox com status, handoff humano e histórico completo do lead.",
                },
                {
                  title: "Atendimento humano",
                  body: "Quando o cliente pede pessoa, a equipe assume e a IA para na hora.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-lg"
                >
                  <div className="flex size-10 items-center justify-center rounded-full border border-brand/25 bg-brand-soft text-brand">
                    <span className="text-lg">◆</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Em 3 passos
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Como funciona
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  n: "1",
                  title: "Conecte seus números",
                  body: "Escaneie o QR e ligue o WhatsApp da empresa em minutos.",
                },
                {
                  n: "2",
                  title: "Configure a IA",
                  body: "Defina identidade, playbook, campos e catálogo.",
                },
                {
                  n: "3",
                  title: "Acompanhe e gerencie",
                  body: "Veja conversas, leads e funil — assuma quando precisar.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-lg"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:gap-10 sm:px-5 sm:py-16 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <ChannelsMock />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                Múltiplos WhatsApps
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Todos os seus números, em{" "}
                <span className="text-brand">um só lugar</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-body sm:text-base sm:text-ink-muted">
                Conecte departamentos diferentes sem misturar atendimento. Cada
                número entra na mesma inbox — com IA e equipe alinhadas.
              </p>
              <button
                type="button"
                onClick={openContact}
                className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep hover:shadow-md active:scale-[0.98]"
              >
                Saiba mais
              </button>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="mx-auto max-w-6xl px-5 pb-20">
            <div className="rounded-3xl border border-line bg-gradient-to-br from-brand-soft via-surface to-surface px-6 py-12 text-center shadow-[var(--shadow)] sm:px-12">
            <div className="mx-auto inline-flex rounded-2xl bg-sidebar px-5 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
              <img
                src="/logo.png"
                alt=""
                className="h-14 w-auto"
              />
            </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Pronto para transformar seu atendimento?
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={openContact}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep hover:shadow-md active:scale-[0.98]"
                >
                  Começar agora
                  <span aria-hidden>→</span>
                </button>
                <a
                  href="#como-funciona"
                  className="rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-divider hover:shadow-sm"
                >
                  Ver como funciona
                </a>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="relative z-10 border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
        ViraChat · Atendimento inteligente para o seu negócio
      </footer>

      <ContactModal open={open} onClose={closeContact} />
    </div>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`land-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function BgWaves() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.28] sm:opacity-55 md:opacity-100"
    >
      <svg
        className="land-drift absolute left-0 top-0 h-[36%] w-[80%] sm:h-[55%] sm:w-[52%]"
        viewBox="0 0 800 700"
        preserveAspectRatio="none"
      >
        <path
          d="M0 0H800C680 40 620 180 520 220C400 270 360 120 240 200C140 265 80 480 0 700V0Z"
          fill="#c5f5eb"
          opacity="0.85"
        />
        <path
          d="M0 0H580C490 35 450 150 380 185C290 230 260 100 175 165C100 220 55 390 0 560V0Z"
          fill="#99f6e4"
          opacity="0.7"
        />
        <path
          d="M0 0H380C320 30 295 120 250 150C190 190 170 80 115 130C70 170 35 300 0 420V0Z"
          fill="#5eead4"
          opacity="0.55"
        />
        <path
          d="M0 0H200C165 25 155 85 130 105C100 130 90 55 60 85C35 110 18 185 0 260V0Z"
          fill="#14b8a6"
          opacity="0.3"
        />
      </svg>

      <svg
        className="land-drift-slow absolute bottom-0 right-0 h-[32%] w-[75%] sm:h-[50%] sm:w-[48%]"
        viewBox="0 0 800 700"
        preserveAspectRatio="none"
      >
        <path
          d="M800 700H0C120 660 180 520 280 480C400 430 440 580 560 500C660 435 720 220 800 0V700Z"
          fill="#99f6e4"
          opacity="0.6"
        />
        <path
          d="M800 700H220C310 665 350 550 420 515C510 470 540 600 625 535C700 480 745 310 800 140V700Z"
          fill="#5eead4"
          opacity="0.5"
        />
        <path
          d="M800 700H420C480 670 505 580 550 550C610 510 630 620 685 570C730 530 765 400 800 280V700Z"
          fill="#14b8a6"
          opacity="0.35"
        />
        <path
          d="M800 700H600C635 675 645 615 670 595C700 570 710 645 740 615C765 590 782 515 800 440V700Z"
          fill="#0f766e"
          opacity="0.2"
        />
      </svg>

      <svg
        className="absolute left-0 top-[28%] hidden h-[360px] w-full opacity-40 sm:block"
        viewBox="0 0 1200 400"
        fill="none"
      >
        <path
          d="M-40 220C120 140 280 300 460 240C640 180 780 80 980 160C1100 210 1180 190 1240 150"
          stroke="#0f766e"
          strokeWidth="1.2"
          opacity="0.35"
        />
        <path
          d="M-20 300C160 220 320 360 500 280C700 190 860 120 1040 200"
          stroke="#14b8a6"
          strokeWidth="1"
          opacity="0.25"
        />
      </svg>
    </div>
  );
}

function HeroMock() {
  return (
    <div className="land-float relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-medium text-ink">Conversas</p>
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
            IA + Humano
          </span>
        </div>
        <div className="flex min-h-[280px]">
          <aside className="hidden w-36 shrink-0 border-r border-white/10 bg-sidebar p-3 text-[11px] text-white/55 sm:block">
            {["Conversas", "Canais", "IA", "Equipe"].map((l, i) => (
              <p
                key={l}
                className={`rounded-lg px-2 py-1.5 ${
                  i === 0 ? "bg-[#134E4A] font-semibold text-white" : ""
                }`}
              >
                {l}
              </p>
            ))}
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-[#0b141a] p-3">
            <div className="land-stagger space-y-2.5 text-sm">
              <Bubble side="in" delay={700}>
                Oi, quero um orçamento
              </Bubble>
              <Bubble side="ai" delay={950}>
                Claro! Quantas pessoas vão usar?
              </Bubble>
              <Bubble side="in" delay={1200}>
                Somos em 12
              </Bubble>
              <Bubble side="ai" delay={1450}>
                Perfeito — montei a proposta. Quer falar com um atendente?
              </Bubble>
              <Bubble side="human" delay={1700}>
                Oi! Sou da equipe. Posso te ajudar a fechar.
              </Bubble>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
  delay = 0,
}: {
  side: "in" | "ai" | "human";
  children: React.ReactNode;
  delay?: number;
}) {
  const mine = side === "in";
  return (
    <div
      className={`land-bubble flex ${mine ? "justify-end" : "justify-start"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${
          mine
            ? "rounded-br-md bg-[#005c4b] text-white"
            : "rounded-bl-md bg-[#1f2c34] text-white"
        }`}
      >
        {!mine ? (
          <p className="mb-0.5 text-[10px] font-semibold text-[#8ce7d0]">
            {side === "ai" ? "IA" : "Atendente"}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function ChannelsMock() {
  const rows = [
    { name: "Vendas", phone: "+55 11 9xxxx-1001" },
    { name: "Suporte", phone: "+55 11 9xxxx-1002" },
    { name: "Financeiro", phone: "+55 11 9xxxx-1003" },
    { name: "Comercial", phone: "+55 11 9xxxx-1004" },
  ];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <p className="text-sm font-semibold text-ink">Números conectados</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 transition hover:border-brand/30"
          >
            <div>
              <p className="text-sm font-medium text-ink">{r.name}</p>
              <p className="text-xs text-ink-muted">{r.phone}</p>
            </div>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
              Ativo
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
