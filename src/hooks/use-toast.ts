import { useCallback } from "react";

import { useOkaneStore, type OkaneState } from "@/stores/okane-store";

export function useToast() {
  const setToast = useOkaneStore((s: OkaneState) => s.setToast);

  const success = useCallback(
    (title: string, message?: string) => setToast({ title, message }),
    [setToast]
  );

  const error = useCallback(
    (title: string, message?: string) => setToast({ title, message }),
    [setToast]
  );

  const info = useCallback(
    (title: string, message?: string) => setToast({ title, message }),
    [setToast]
  );

  return { success, error, info };
}

