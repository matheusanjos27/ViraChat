import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { isUiPreview } from "@/lib/dev/ui-preview";

function LoginWaves() {
  return (
    <>
      {/* Top-left wavy diagonal corner */}
      <svg
        className="pointer-events-none absolute left-0 top-0 h-[55%] w-[75%] sm:h-[62%] sm:w-[58%]"
        viewBox="0 0 800 700"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 0H800C680 40 620 180 520 220C400 270 360 120 240 200C140 265 80 480 0 700V0Z"
          fill="#c5f5eb"
          opacity="0.8"
        />
        <path
          d="M0 0H580C490 35 450 150 380 185C290 230 260 100 175 165C100 220 55 390 0 560V0Z"
          fill="#99f6e4"
          opacity="0.65"
        />
        <path
          d="M0 0H380C320 30 295 120 250 150C190 190 170 80 115 130C70 170 35 300 0 420V0Z"
          fill="#5eead4"
          opacity="0.5"
        />
        <path
          d="M0 0H200C165 25 155 85 130 105C100 130 90 55 60 85C35 110 18 185 0 260V0Z"
          fill="#14b8a6"
          opacity="0.28"
        />
      </svg>

      {/* Bottom-right wavy diagonal corner */}
      <svg
        className="pointer-events-none absolute bottom-0 right-0 h-[58%] w-[80%] sm:h-[66%] sm:w-[60%]"
        viewBox="0 0 800 700"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M800 700H0C120 660 180 520 280 480C400 430 440 580 560 500C660 435 720 220 800 0V700Z"
          fill="#99f6e4"
          opacity="0.55"
        />
        <path
          d="M800 700H220C310 665 350 550 420 515C510 470 540 600 625 535C700 480 745 310 800 140V700Z"
          fill="#5eead4"
          opacity="0.5"
        />
        <path
          d="M800 700H420C480 670 505 580 550 550C610 510 630 620 685 570C730 530 765 400 800 280V700Z"
          fill="#14b8a6"
          opacity="0.38"
        />
        <path
          d="M800 700H600C635 675 645 615 670 595C700 570 710 645 740 615C765 590 782 515 800 440V700Z"
          fill="#0f766e"
          opacity="0.22"
        />
      </svg>
    </>
  );
}

export default function LoginPage() {
  const preview = isUiPreview();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f7f6] px-4 py-14">
      <LoginWaves />

      <div className="rise-in relative z-10 w-full max-w-[400px]">
        <div className="mb-7 text-center">
          <div className="mx-auto inline-flex items-center justify-center rounded-2xl bg-[#0F172A] px-5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
            <img
              src="/logo.png"
              alt="ViraChat"
              className="h-14 w-auto object-contain sm:h-16"
            />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-brand-deep">
            Entre na sua conta
          </h1>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white p-7 shadow-[0_12px_40px_rgba(15,118,110,0.08)]">
          {preview ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-ink-muted">
                Modo preview local — telas vazias, sem banco nem integrações.
              </p>
              <Link
                href="/app/conversations"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep"
              >
                Abrir painel
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : (
            <LoginForm />
          )}
        </div>
      </div>
    </main>
  );
}
