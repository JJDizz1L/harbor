// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(new URL("../src-tauri/src/thumbs.rs", import.meta.url), "utf8");

test("thumbnail workers are owned and reaped by Harbor", () => {
  assert.match(source, /kill_on_drop\(true\)/);
  assert.match(source, /child\.wait\(\)\.await/);
});
