export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        This page hasn&apos;t been cached yet. Your saved notes are still available from the home screen.
      </p>
    </div>
  );
}
