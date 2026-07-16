// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const tmdbSource = readFileSync(
  new URL("../src/lib/providers/tmdb/tmdb-client.ts", import.meta.url),
  "utf8",
);
const nativeHttpSource = readFileSync(
  new URL("../src-tauri/src/http_fetch.rs", import.meta.url),
  "utf8",
);

test("TMDB uses Harbor's bounded shared HTTP path", () => {
  assert.match(tmdbSource, /import \{ safeFetch \} from "@\/lib\/safe-fetch"/);
  assert.match(tmdbSource, /createRequestScheduler/);
  assert.doesNotMatch(tmdbSource, /@tauri-apps\/plugin-http/);
});

test("native HTTP concurrency is bounded on every platform", () => {
  assert.match(nativeHttpSource, /fetch_semaphore\(\)\s*\.acquire\(\)/);
  assert.doesNotMatch(nativeHttpSource, /limit_concurrent_fetches/);
  assert.doesNotMatch(nativeHttpSource, /std::env::consts::OS/);
});
