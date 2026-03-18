import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type NoticeType = "info" | "warning" | "success";

export function Notice({
  type,
  title,
  description,
  className
}: {
  type: NoticeType;
  title?: string;
  description: string;
  className?: string;
}) {
  const meta = (() => {
    if (type === "warning") {
      return {
        icon: AlertTriangle,
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        border: "border-yellow-200/70 dark:border-yellow-900/60",
        iconColor: "text-yellow-700 dark:text-yellow-300"
      } as const;
    }
    if (type === "success") {
      return {
        icon: CheckCircle2,
        bg: "bg-green-50 dark:bg-green-950/30",
        border: "border-green-200/70 dark:border-green-900/60",
        iconColor: "text-green-700 dark:text-green-300"
      } as const;
    }
    return {
      icon: Info,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200/70 dark:border-blue-900/60",
      iconColor: "text-blue-700 dark:text-blue-300"
    } as const;
  })();

  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border p-4 shadow-sm shadow-black/5 animate-in fade-in",
        meta.bg,
        meta.border,
        className
      )}
    >
      <div className={cn("mt-0.5 shrink-0", meta.iconColor)} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        {title ? <div className="text-sm font-semibold tracking-tight">{title}</div> : null}
        <div className={cn("text-sm text-muted-foreground", title ? "mt-1" : "")}>{description}</div>
      </div>
    </div>
  );
}

