"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

export default function LoginPage() {
  const router = useRouter();
  const user = useOkaneStore((s: OkaneState) => s.user);
  const hasHydrated = useOkaneStore((s: OkaneState) => s.hasHydrated);
  const onboardingCompleted = useOkaneStore((s: OkaneState) => s.onboarding.completed);
  const signIn = useOkaneStore((s: OkaneState) => s.signInWithGoogleMock);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) return;
    router.replace(onboardingCompleted ? "/dashboard" : "/onboarding");
  }, [hasHydrated, onboardingCompleted, router, user]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Okane</CardTitle>
          <CardDescription>Mindful budgeting, focused on numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => {
              signIn();
              router.replace(onboardingCompleted ? "/dashboard" : "/onboarding");
            }}
          >
            <Chrome />
            Continue with Google
          </Button>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Frontend-only mock authentication.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
