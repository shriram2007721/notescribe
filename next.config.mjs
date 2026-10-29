import withPWAInit from "@ducanh2912/next-pwa";

const revision = Date.now().toString();
// Set by CI when hosting under a sub-path (GitHub Pages serves at /<repo>). Empty for root hosting.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  fallbacks: { document: `${basePath}/offline` },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // Activate a new deploy straight away; AppShell reloads once when it takes over.
    skipWaiting: true,
    clientsClaim: true,
    // App-shell routes that must open offline even if never visited.
    additionalManifestEntries: ["/", "/note", "/flashcards", "/flashcards/review", "/study", "/settings", "/community", "/shared", "/offline"].map((url) => ({ url: `${basePath}${url}`, revision })),
    // transformers.js + its WASM runtime (20+ MB) exceed Workbox's 2 MB precache limit, so cache them on first use instead.
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith(`${basePath}/vendor/transformers/`),
        handler: "CacheFirst",
        options: { cacheName: "transformers-runtime", expiration: { maxEntries: 10 } },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: static hosts (GitHub Pages, Azure Static Web Apps) serve plain files; the app is fully client-side.
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default withPWA(nextConfig);
