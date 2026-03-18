"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!session?.user?.email) return;

    void (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { onboardingCompleted?: boolean };
        const onboardingCompleted = Boolean(json.onboardingCompleted);
        router.replace(onboardingCompleted ? "/dashboard" : "/onboarding");
      } catch {
        return;
      }
    })();
  }, [router, session?.user?.email, status]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Okane</CardTitle>
          <CardDescription>Mindful budgeting, focused on numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Button
              type="button"
              className="w-full"
              onClick={() => void signIn("google")}
              disabled={status === "loading"}
              aria-busy={status === "loading"}
            >
              Continue with Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
