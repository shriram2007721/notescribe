"use client";

import { NotebookPen, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "My notes" },
  { href: "/community", label: "Community" },
];

export function AppHeader() {
  const pathname = usePathname();
  const online = useOnline();

  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <NotebookPen className="h-5 w-5 text-primary" />
          <span>NoteScribe</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                pathname === n.href && "bg-accent text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {!online && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        )}
      </div>
    </header>
  );
}
