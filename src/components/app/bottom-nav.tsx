"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, NotebookPen, PieChart, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const navItems = [
    { href: "/dashboard", label: "Home", icon: BarChart3 },
    { href: "/budget", label: "Plan", icon: PieChart },
    { href: "/reflection", label: "Reflect", icon: Sparkles },
    { href: "/transactions/new", label: "Add", icon: NotebookPen }
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur">
      <div className="mx-auto grid w-full max-w-md grid-cols-4 px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
