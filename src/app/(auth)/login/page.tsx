"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

declare global {
  interface Window {
    google?: unknown;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const user = useOkaneStore((s: OkaneState) => s.user);
  const hasHydrated = useOkaneStore((s: OkaneState) => s.hasHydrated);
  const onboardingCompleted = useOkaneStore((s: OkaneState) => s.onboarding.completed);
  const signIn = useOkaneStore((s: OkaneState) => s.signInWithGoogle);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const clientId = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "", []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) return;
    router.replace(onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [hasHydrated, onboardingCompleted, router, user]);

  const init = useCallback(
    async (token: string) => {
      setError(null);
      const ok = await signIn(token);
      if (!ok) {
        setError("Login Google gagal. Coba ulangi beberapa saat lagi.");
        return;
      }
      router.replace(onboardingCompleted ? "/dashboard" : "/onboarding");
    },
    [onboardingCompleted, router, signIn]
  );

  const initializeGsi = useCallback(() => {
    if (!clientId) return;
    if (!btnRef.current) return;
    const g = window.google as
      | {
          accounts?: {
            id?: {
              initialize?: (args: { client_id: string; callback: (res: { credential?: string }) => void }) => void;
              renderButton?: (el: HTMLElement, opts: Record<string, unknown>) => void;
            };
          };
        }
      | undefined;
    const api = g?.accounts?.id;
    if (!api?.initialize || !api?.renderButton) return;

    btnRef.current.innerHTML = "";
    api.initialize({
      client_id: clientId,
      callback: (res) => {
        const token = typeof res.credential === "string" ? res.credential : "";
        if (!token) {
          setError("Login Google gagal. Token tidak ditemukan.");
          return;
        }
        void init(token);
      }
    });
    api.renderButton(btnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 320
    });
  }, [clientId, init]);

  useEffect(() => {
    initializeGsi();
  }, [initializeGsi]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      {clientId ? (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initializeGsi} />
      ) : null}
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Okane</CardTitle>
          <CardDescription>Mindful budgeting, focused on numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {clientId ? (
              <div ref={btnRef} className="flex min-h-11 justify-center" />
            ) : (
              <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
                Google login belum dikonfigurasi. Set <span className="font-semibold text-foreground">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span>{" "}
                di environment deploy.
              </div>
            )}
            {error ? <div className="text-sm text-rose-600">{error}</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
