import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="rise-in w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="ViraChat" className="mx-auto h-14 w-auto" />
          <h1 className="mt-3 text-lg text-ink-muted">Entre na sua conta</h1>
        </div>
        <div className="auth-panel rounded-2xl p-7">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
