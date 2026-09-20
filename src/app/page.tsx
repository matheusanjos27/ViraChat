import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#071c19] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 15% 10%, rgba(12,107,92,0.55), transparent 55%), radial-gradient(ellipse 45% 40% at 90% 15%, rgba(201,242,166,0.22), transparent 50%), linear-gradient(180deg, #071c19 0%, #0a2a24 55%, #0d332c 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M36 0h1v72h-1zM0 36h72v1H0z' fill='%23ffffff' fill-opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="brand-mark rise-in text-5xl sm:text-6xl md:text-7xl">
          ViraChat
        </p>
        <h1 className="rise-in mt-5 max-w-xl text-xl font-normal leading-relaxed text-white/80 sm:text-2xl [animation-delay:80ms]">
          Atendimento com IA no WhatsApp. A IA responde; o humano entra quando
          precisa — tudo num só lugar.
        </h1>
        <div className="rise-in mt-10 flex flex-wrap gap-3 [animation-delay:160ms]">
          <Link
            href="/login"
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-brand-deep transition hover:brightness-105"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
