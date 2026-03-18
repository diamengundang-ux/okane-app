"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.email) {
      if (pathname === "/login") return;
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { onboardingCompleted?: boolean };
        const onboardingCompleted = Boolean(json.onboardingCompleted);

        if (!onboardingCompleted) {
          if (pathname === "/onboarding") return;
          router.replace("/onboarding");
          return;
        }

        if (pathname === "/onboarding") {
          router.replace("/dashboard");
        }
      } catch {
        return;
      }
    })();
  }, [pathname, router, session?.user?.email, status]);
}
