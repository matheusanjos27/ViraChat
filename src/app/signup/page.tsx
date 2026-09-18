import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="rise-in w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="brand-mark text-4xl text-brand-deep">ViraChat</p>
          <h1 className="mt-3 text-lg text-ink-muted">Crie sua conta</h1>
        </div>
        <div className="auth-panel rounded-2xl p-7">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
