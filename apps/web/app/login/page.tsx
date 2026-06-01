"use client";

import { Suspense } from "react";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNextPath = searchParams.get("next");
  const nextPath = rawNextPath === "/inventory" ? "/inventory" : "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const allowedEmails = ["shantanusapkal007@gmail.com", "ajitpatil220@gmail.com", "atuldeore369@gmail.com"];
    if (!allowedEmails.includes(email.toLowerCase().trim())) {
      setError("This email is not authorized to access the system.");
      setPending(false);
      return;
    }

    try {
      let userCredential;
      if (mode === "signin") {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }

      // Get ID token to create session cookie
      const idToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!sessionResponse.ok) {
        throw new Error("Failed to create session.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-outline-variant/40 bg-white/95 p-5 shadow-[0_20px_70px_rgba(31,26,27,0.1)] backdrop-blur-xl sm:p-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-secondary-container">
            Secure POS
          </p>
          <h1 className="mt-2 font-headline text-2xl font-bold text-primary">
            {mode === "signin" ? "Sign in" : "Create your store"}
          </h1>
          <p className="mt-2 text-sm text-on-secondary-container">
            Each account gets isolated products, bills, and stock.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Email
            </span>
            <input
              className="field-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Password
            </span>
            <input
              className="field-input"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}

          <button className="button button-primary w-full" disabled={pending} type="submit">
            {pending ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="mt-4 w-full text-sm font-bold text-primary"
          type="button"
          onClick={() => {
            setMode((current) => (current === "signin" ? "signup" : "signin"));
            setError(null);
            setMessage(null);
          }}
        >
          {mode === "signin" ? "Create a new store account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
