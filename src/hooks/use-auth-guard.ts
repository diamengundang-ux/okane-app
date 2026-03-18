"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useOkaneStore((s: OkaneState) => s.user);
  const hasHydrated = useOkaneStore((s: OkaneState) => s.hasHydrated);
  const onboardingCompleted = useOkaneStore((s: OkaneState) => s.onboarding.completed);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      if (pathname === "/login") return;
      router.replace("/login");
      return;
    }

    if (!onboardingCompleted) {
      if (pathname === "/onboarding") return;
      router.replace("/onboarding");
      return;
    }

    if (pathname === "/onboarding") {
      router.replace("/dashboard");
    }
  }, [hasHydrated, onboardingCompleted, pathname, router, user]);
}
