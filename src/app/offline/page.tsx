export default function OfflinePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        This page hasn&apos;t been cached yet. Your saved notes are still available from the home screen.
      </p>
    </main>
  );
}
