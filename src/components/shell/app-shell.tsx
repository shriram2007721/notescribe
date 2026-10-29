"use client";

import {
  BookOpenCheck,
  Folder as FolderIcon,
  FolderPlus,
  GraduationCap,
  Inbox,
  Layers,
  Menu,
  Moon,
  NotebookPen,
  Search,
  Settings,
  Sun,
  Trash2,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useFolders } from "@/hooks/use-data";
import { useOnline } from "@/hooks/use-online";
import { loadTags } from "@/lib/highlights";
import { loadSampleData } from "@/lib/sample-data";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { FolderDialog } from "./folder-dialog";
import { StorageGuard } from "./storage-guard";

const NAV = [
  { href: "/", label: "My notes", icon: NotebookPen },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/study", label: "Study", icon: GraduationCap },
  { href: "/community", label: "Community", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const online = useOnline();
  const pathname = usePathname();
  // Saved highlight tags are read after mount, so the page content renders only then (avoids a hydration mismatch).
  const [tagsReady, setTagsReady] = useState(false);

  useEffect(() => {
    loadTags();
    setTagsReady(true);
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // First visit: fill the empty notebook with sample notes, flashcards and quiz history (runs once).
  useEffect(() => {
    loadSampleData().catch(() => {});
  }, []);

  // When a newer deploy's service worker takes over, reload once so the new version is shown.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) return; // first install: the page is already current
    let reloaded = false;
    const onChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onChange);
    return () => sw.removeEventListener("controllerchange", onChange);
  }, []);

  // Ctrl/Cmd+K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside data-chrome className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-card lg:flex lg:flex-col">
        <Suspense>
          <SidebarContent onSearch={() => setPaletteOpen(true)} />
        </Suspense>
      </aside>

      {/* Mobile top bar */}
      <header data-chrome className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-md p-2 hover:bg-accent" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <NotebookPen className="h-5 w-5 text-primary" /> NoteScribe
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {!online && <OfflineBadge />}
          <button type="button" onClick={() => setPaletteOpen(true)} className="rounded-md p-2 hover:bg-accent" aria-label="Search and commands">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl animate-in slide-in-from-left">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 rounded-md p-2 hover:bg-accent"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <Suspense>
              <SidebarContent onSearch={() => setPaletteOpen(true)} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="app-main lg:pl-60">
        {!online && (
          <div data-chrome className="hidden border-b bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground lg:block">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" /> You&apos;re offline. Notes, flashcards and quizzes keep working and save on this device.
          </div>
        )}
        <StorageGuard />
        <main id="main">{tagsReady ? children : null}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function OfflineBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
      <WifiOff className="h-3.5 w-3.5" /> Offline
    </span>
  );
}

function SidebarContent({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const folders = useFolders();
  const { isDark, toggle } = useTheme();
  const [folderDialog, setFolderDialog] = useState(false);
  const activeFolder = pathname === "/" ? params.get("folder") : null;
  const view = pathname === "/" ? params.get("view") : null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" && !activeFolder && !view : pathname.startsWith(href));

  return (
    <>
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <NotebookPen className="h-5 w-5 text-primary" />
        <Link href="/">NoteScribe</Link>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onSearch}
          className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border bg-muted px-1.5 text-[10px] font-medium">Ctrl K</kbd>
        </button>
      </div>

      <nav aria-label="Main" className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  isActive(href) && "bg-accent font-medium text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between px-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subjects</h2>
          <button
            type="button"
            onClick={() => setFolderDialog(true)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-primary hover:bg-accent"
            aria-label="New subject"
          >
            <FolderPlus className="h-4 w-4" /> New
          </button>
        </div>
        <ul className="mt-1 space-y-0.5">
          {folders?.map((f) => (
            <li key={f.id}>
              <Link
                href={`/?folder=${f.id}`}
                aria-current={activeFolder === f.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  activeFolder === f.id && "bg-accent font-medium text-foreground",
                )}
              >
                <FolderIcon className="h-4 w-4 shrink-0" /> <span className="truncate">{f.name}</span>
              </Link>
            </li>
          ))}
          {folders?.length === 0 && (
            <li>
              <button type="button" onClick={() => setFolderDialog(true)} className="w-full rounded-md px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent">
                + Add a subject to group notes
              </button>
            </li>
          )}
          <li>
            <Link
              href="/?folder=unfiled"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                activeFolder === "unfiled" && "bg-accent font-medium text-foreground",
              )}
            >
              <Inbox className="h-4 w-4" /> Unfiled
            </Link>
          </li>
          <li>
            <Link
              href="/?view=trash"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                view === "trash" && "bg-accent font-medium text-foreground",
              )}
            >
              <Trash2 className="h-4 w-4" /> Trash
            </Link>
          </li>
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t px-4 py-3">
        <Link href="/flashcards/review" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <BookOpenCheck className="h-4 w-4" /> Review cards
        </Link>
        <button type="button" onClick={toggle} className="rounded-md p-2 hover:bg-accent" aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <FolderDialog open={folderDialog} onClose={() => setFolderDialog(false)} />
    </>
  );
}
