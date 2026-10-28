// Copies the prebuilt transformers.js browser bundle (with onnxruntime-web inside) and its
// WASM runtime into public/vendor. The Whisper worker imports them at runtime, so:
//  - they bypass Next's bundler/minifier (which can't handle their `import.meta` usage), and
//  - they're served from our own origin, so the service worker can cache them for offline use.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/@huggingface/transformers/dist";
const target = join("public", "vendor", "transformers");
mkdirSync(target, { recursive: true });

const files = readdirSync(src).filter((f) => f === "transformers.min.js" || /^ort-wasm.*\.(wasm|mjs)$/.test(f));
for (const f of files) cpSync(join(src, f), join(target, f));
console.log(`[copy-transformers] copied ${files.join(", ")} to public/vendor/transformers`);
