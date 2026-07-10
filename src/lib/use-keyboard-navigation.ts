import { useEffect, useRef } from 'react';

type Dir = 'up' | 'down' | 'left' | 'right';

const SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  '[data-focusable="true"]',
].join(', ');

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Up: 'up', Down: 'down', Left: 'left', Right: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};

const CODE_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

const KEYCODE_TO_DIR: Record<number, Dir> = {
  38: 'up', 40: 'down', 37: 'left', 39: 'right',
  19: 'up', 20: 'down', 21: 'left', 22: 'right',
  87: 'up', 83: 'down', 65: 'left', 68: 'right',
};

const CENTER_KEYCODES = new Set([13, 23, 32]);

// 4 = Android TV / Android WebView hardware BACK (KEYCODE_BACK)
const BACK_KEYCODES = new Set([27, 4, 461, 10009, 166]);
const BACK_KEYS = new Set(['Escape', 'Esc', 'BrowserBack', 'GoBack', 'Back']);

// FIX #3: was 5px — way too tight for TV-scale layouts where cards/rows
// are large and have padding/margins that create small axis offsets.
// A small tolerance rejected valid neighbors or accepted wrong ones,
// which is a big part of "moves through elements but doesn't know direction".
const AXIS_TOLERANCE = 24;

function isEditable(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function isVisible(el: HTMLElement) {
  if (!el.isConnected) return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (el.getClientRects().length === 0) return false;
  return true;
}

function isInNav(el: HTMLElement): boolean {
  // Zone wrapper — do NOT use [data-harbor-nav] (that's a per-item theme hook).
  return !!el.closest("[data-tv-nav-zone], [data-harbor-sidebar]");
}

function isInHero(el: HTMLElement): boolean {
  return !!el.closest('[data-tv-hero-zone]');
}

function zoneOf(el: HTMLElement): 'nav' | 'hero' | 'content' {
  if (isInNav(el)) return 'nav';
  if (isInHero(el)) return 'hero';
  return 'content';
}

// FIX #2: dedupe nested focusable matches. If a card wrapper AND one of
// its own descendants (e.g. an inner button, an <a> with a nested
// tabindex icon) both match SELECTOR, the old code treated them as two
// separate focus targets sitting almost on top of each other. That is
// exactly what causes "it moves between elements but doesn't understand
// left/right" — it's often hopping between a card and its own child.
// Rule: only the OUTERMOST matching element per DOM branch is kept.
/** Topmost fullscreen overlay/modal that should trap TV/remote focus. */
function getTopFocusScope(): HTMLElement | null {
  const scopes = document.querySelectorAll<HTMLElement>(
    "[data-tv-focus-scope], [data-search-overlay]",
  );
  return scopes.length ? scopes[scopes.length - 1]! : null;
}

function getFocusable(): HTMLElement[] {
  // While a scoped overlay/modal is open, ignore page chrome behind it.
  const root: ParentNode = getTopFocusScope() ?? document;
  const all = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(isVisible);
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

function getFocusableInZone(zone: 'nav' | 'hero' | 'content'): HTMLElement[] {
  return getFocusable().filter((el) => zoneOf(el) === zone);
}

function getRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    width: r.width, height: r.height,
    cx: r.left + r.width / 2, cy: r.top + r.height / 2,
  };
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Same-row (or same-column) neighbor — rejects diagonal "left" hits that steal edge→sidebar. */
function isAxisAligned(a: HTMLElement, b: HTMLElement, dir: Dir): boolean {
  const ra = getRect(a);
  const rb = getRect(b);
  if (dir === "left" || dir === "right") {
    const ov = overlap(ra.top, ra.bottom, rb.top, rb.bottom);
    const minH = Math.min(ra.height, rb.height);
    return ov >= Math.max(12, minH * 0.25);
  }
  const ov = overlap(ra.left, ra.right, rb.left, rb.right);
  const minW = Math.min(ra.width, rb.width);
  return ov >= Math.max(12, minW * 0.25);
}

function pickNavTarget(navItems: HTMLElement[]): HTMLElement | null {
  return (
    navItems.find((el) => el.matches("[data-harbor-nav][data-active]")) ??
    navItems.find((el) => el.hasAttribute("data-harbor-nav")) ??
    getInitialFocus(navItems)
  );
}

function getDirection(e: KeyboardEvent): Dir | null {
  if (KEY_TO_DIR[e.key]) return KEY_TO_DIR[e.key];
  if (CODE_TO_DIR[e.code]) return CODE_TO_DIR[e.code];
  return KEYCODE_TO_DIR[e.keyCode] ?? null;
}

function isBackKey(e: KeyboardEvent): boolean {
  if (BACK_KEYS.has(e.key)) return true;
  if (BACK_KEYCODES.has(e.keyCode)) return true;
  return false;
}

function getInitialFocus(list: HTMLElement[]) {
  return list.find((el) => el.hasAttribute('data-tv-initial-focus')) ?? list[0] ?? null;
}

const NAV_FOCUS_SELECTOR =
  "[data-harbor-nav][data-active], [data-harbor-nav], [data-tv-nav-zone] button, [data-harbor-sidebar] button, [data-tv-nav-zone] a[href], [data-tv-nav-zone] [data-focusable='true']";

function focusNavChrome() {
  const nav = document.querySelector<HTMLElement>(NAV_FOCUS_SELECTOR);
  if (nav) focusElement(nav);
}

/** Focus the page's primary control (Play, etc.) or first content focusable. */
export function focusTvPageDefault(): void {
  ensureFocusStyles();
  const scope = getTopFocusScope();
  if (scope) {
    const scoped = getFocusable();
    const first = getInitialFocus(scoped);
    if (first) focusElement(first);
    return;
  }
  const marked = document.querySelector<HTMLElement>("[data-tv-initial-focus]");
  if (marked && isVisible(marked)) {
    focusElement(marked);
    return;
  }
  const content = getFocusableInZone("content");
  const first = getInitialFocus(content);
  if (first) focusElement(first);
}

/** Close the top TV focus-scoped modal via its close control, if any. */
function closeTopFocusScope(): boolean {
  const scope = getTopFocusScope();
  if (!scope || scope.hasAttribute("data-search-overlay")) return false;
  const closer = scope.querySelector<HTMLElement>("[data-tv-modal-close]");
  if (!closer) return false;
  closer.click();
  return true;
}

let focusStylesInjected = false;
function ensureFocusStyles() {
  if (focusStylesInjected || typeof document === 'undefined') return;
  focusStylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-tv-focus-styles', 'true');
  // FIX #1: removed `transform: scale(1.03)`.
  // getBoundingClientRect() reflects the element AFTER transforms are
  // applied. Scaling the focused element on every focus change means
  // its own rect (and therefore cx/cy/left/right used by findBest)
  // shifts slightly every time it becomes focused — which corrupts the
  // directional math for whatever gets focused next. This was the
  // single biggest cause of "arrow keys move focus but not in the
  // direction pressed". Outline/box-shadow are safe because they don't
  // affect layout or the geometry box used for hit-testing.
  style.textContent = `
    [data-tv-focused="true"] {
      outline: 2px solid var(--color-accent) !important;
      outline-offset: 2px;
      z-index: 20;
      position: relative;
    }
  `;
  document.head.appendChild(style);
}

let lastFocusedEl: HTMLElement | null = null;

function focusElement(el: HTMLElement) {
  ensureFocusStyles();
  if (lastFocusedEl && lastFocusedEl !== el) {
    lastFocusedEl.removeAttribute('data-tv-focused');
  }
  el.setAttribute('data-tv-focused', 'true');
  lastFocusedEl = el;

  el.focus({ preventScroll: true });
  if (isInHero(el)) {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    return;
  }
  el.scrollIntoView({
    block: 'center',
    inline: 'center',
    behavior: 'smooth',
  });
}

function findBest(focused: HTMLElement, candidates: HTMLElement[], dir: Dir): HTMLElement | null {
  const src = getRect(focused);
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    if (el === focused) continue;
    const dst = getRect(el);

    if (dir === 'right' && dst.cx <= src.cx + AXIS_TOLERANCE) continue;
    if (dir === 'left' && dst.cx >= src.cx - AXIS_TOLERANCE) continue;
    if (dir === 'down' && dst.cy <= src.cy + AXIS_TOLERANCE) continue;
    if (dir === 'up' && dst.cy >= src.cy - AXIS_TOLERANCE) continue;

    const horizontal = dir === 'left' || dir === 'right';

    const primary =
      dir === 'right' ? Math.max(0, dst.left - src.right) :
      dir === 'left' ? Math.max(0, src.left - dst.right) :
      dir === 'down' ? Math.max(0, dst.top - src.bottom) :
      Math.max(0, src.top - dst.bottom);

    const secondary = horizontal ? Math.abs(dst.cy - src.cy) : Math.abs(dst.cx - src.cx);

    const axisOverlap = horizontal
      ? overlap(src.top, src.bottom, dst.top, dst.bottom)
      : overlap(src.left, src.right, dst.left, dst.right);

    const overlapBonus = axisOverlap > 0 ? axisOverlap * 10 : 0;
    const score = primary * 10 + secondary * 3 - overlapBonus;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function getSpatialOrder(list: HTMLElement[]) {
  return [...list].sort((a, b) => {
    const ra = getRect(a);
    const rb = getRect(b);
    if (Math.abs(ra.top - rb.top) > 8) return ra.top - rb.top;
    return ra.left - rb.left;
  });
}

type TVNavigationOptions = {
  wrap?: boolean;
  onBack?: () => boolean;
  onBackToNav?: () => void;
};

export function useKeyboardNavigation(options: TVNavigationOptions = {}) {
  const { wrap = true, onBack, onBackToNav } = options;
  const onBackRef = useRef(onBack);
  const onBackToNavRef = useRef(onBackToNav);
  const wrapRef = useRef(wrap);
  onBackRef.current = onBack;
  onBackToNavRef.current = onBackToNav;
  wrapRef.current = wrap;

  useEffect(() => {
    const runBack = () => {
      // Fullscreen modals (local episode picker, etc.) — close before view stack.
      if (closeTopFocusScope()) return;
      const handled = onBackRef.current ? onBackRef.current() : false;
      if (!handled) {
        if (onBackToNavRef.current) onBackToNavRef.current();
        else focusNavChrome();
      }
    };

    // Phone remote Back calls these imperatively (synthetic Esc is ignored).
    remoteBackFns = {
      onBack: () => {
        if (closeTopFocusScope()) return true;
        return onBackRef.current?.() ?? false;
      },
      onBackToNav: () => onBackToNavRef.current?.(),
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const target = e.target instanceof HTMLElement ? e.target : null;

      if (isBackKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        runBack();
        return;
      }

      if (isEditable(target)) {
        // Keep Left/Right for caret; allow Up/Down to leave the search field into results.
        const leaveDir = getDirection(e);
        if (
          (leaveDir !== "up" && leaveDir !== "down") ||
          !target?.closest("[data-tv-focus-scope], [data-search-overlay]")
        ) {
          return;
        }
      }

      const dir = getDirection(e);

      if (dir) {
        e.preventDefault();
        e.stopPropagation();

        const active =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const zone = active ? zoneOf(active) : "content";
        const all = getFocusableInZone(zone);
        if (!all.length) return;

        if (!active || !all.includes(active)) {
          // Prefer page primary CTA over DOM-order (avoids sidebar collapse).
          if (zone === "content") {
            const marked = document.querySelector<HTMLElement>("[data-tv-initial-focus]");
            if (marked && isVisible(marked) && all.includes(marked)) {
              focusElement(marked);
              return;
            }
          }
          const first = getInitialFocus(all);
          if (first) focusElement(first);
          return;
        }

        if (zone === "hero" && (dir === "up" || dir === "down")) {
          if (dir === "down") {
            const contentItems = getFocusableInZone("content");
            const first = getInitialFocus(contentItems);
            if (first) focusElement(first);
          }
          return;
        }

        const best = findBest(active, all, dir);

        // Edge Left from page content → sidebar when nothing is truly to the left
        // (same row). Without this, diagonal hits (floating back, other rows) win
        // ~half the time and sidebar feels random.
        if (dir === "left" && (zone === "content" || zone === "hero")) {
          if (!best || !isAxisAligned(active, best, "left")) {
            const navItems = getFocusableInZone("nav");
            const target = pickNavTarget(navItems);
            if (target) {
              focusElement(target);
              return;
            }
          }
        }

        if (best) {
          focusElement(best);
          return;
        }

        // Cross zone: nav → page (Right).
        if (dir === "right" && zone === "nav") {
          const contentItems = getFocusableInZone("content");
          const marked = document.querySelector<HTMLElement>("[data-tv-initial-focus]");
          const target =
            marked && isVisible(marked) && contentItems.includes(marked)
              ? marked
              : getInitialFocus(contentItems);
          if (target) {
            focusElement(target);
            return;
          }
        }

        if (wrapRef.current) {
          const ordered = getSpatialOrder(all);
          const idx = ordered.indexOf(active);
          if (idx >= 0) {
            const next =
              dir === "down" || dir === "right"
                ? (ordered[idx + 1] ?? ordered[0])
                : (ordered[idx - 1] ?? ordered[ordered.length - 1]);
            if (next) focusElement(next);
          }
        }
        return;
      }

      const isCenter = CENTER_KEYCODES.has(e.keyCode) || e.key === "Enter" || e.code === "Enter";
      if (!isCenter) return;

      const active =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!active || isEditable(active)) return;

      const nativeClickable = active.matches(
        'button, a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]',
      );

      if (e.key === " " && nativeClickable) return;
      if (e.key === "Enter" && nativeClickable) return;

      e.preventDefault();
      e.stopPropagation();
      active.click();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}

type RemoteBackFns = {
  onBack?: () => boolean;
  onBackToNav?: () => void;
};

let remoteBackFns: RemoteBackFns = {};

/**
 * Phone touchpad entry point. Keeps keyboard handling untouched:
 * - arrows reuse the existing keydown path
 * - select/back call DOM click / App back handlers (synthetic Enter/Esc are ignored by Chromium)
 */
export function dispatchTvNav(action: Dir | "select" | "back"): void {
  if (action === "select") {
    const active =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && !isEditable(active)) active.click();
    return;
  }

  if (action === "back") {
    const handled = remoteBackFns.onBack?.() ?? false;
    if (handled) return;
    if (remoteBackFns.onBackToNav) {
      remoteBackFns.onBackToNav();
      return;
    }
    focusNavChrome();
    return;
  }

  const key =
    action === "up"
      ? "ArrowUp"
      : action === "down"
        ? "ArrowDown"
        : action === "left"
          ? "ArrowLeft"
          : "ArrowRight";
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }),
  );
}
