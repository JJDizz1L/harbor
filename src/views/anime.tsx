import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimeGenrePicker } from "@/components/anime-genre-picker";
import { AnimeHero } from "@/components/anime-hero";
import { BackToTop } from "@/components/back-to-top";
import { ContinueCard } from "@/components/continue-card";
import { PickCard } from "@/components/pick-card";
import { Row, ScrollRootContext } from "@/components/row";
import { AnimeRankCard } from "@/components/top-rank-card";
import { useAuth } from "@/lib/auth";
import { loadAddonRows, normalizeName, type AddonRow } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import { findTopAward, parseAwardYear, uniqueWinnerFranchisesAcrossSources } from "@/lib/anime-awards";
import { useAnimeTopPicks } from "@/lib/use-anime-top-picks";
import { useCrunchyrollAwardMetas } from "@/lib/use-crunchyroll-award-metas";
import { useWatchHistoryRecommendations } from "@/lib/use-watch-history-recs";
import { AnilistRows } from "./anime/anilist-rows";
import { AnilistRowControls } from "./anime/anilist-row-controls";
import { AnilistTopRow, AnilistTrendingRow } from "./anime/anilist-top-row";
import {
  animeFranchiseKey,
  GENRE,
  jikanAiringNow,
  jikanByEra,
  jikanByGenre,
  jikanTopAiring,
  jikanTopAnime,
  jikanTopMovies,
  jikanTopPopular,
  jikanTopTv,
  jikanUnderratedGems,
  jikanUpcoming,
  stripFranchiseSuffix,
} from "@/lib/providers/jikan";
import { useSettings } from "@/lib/settings";
import { isAdultAnime } from "@/lib/addons-store/adult-filter";
import { library, type LibraryItem } from "@/lib/stremio";
import { useScrollMemory } from "@/lib/view";

type Spec = {
  key: string;
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  rank?: boolean;
};

const SPECS: Spec[] = [
  { key: "airing", title: "Airing Now", fetcher: jikanAiringNow },
  { key: "top-airing", title: "Top Airing on MAL", fetcher: jikanTopAiring, rank: true },
  { key: "upcoming", title: "Upcoming Season", fetcher: jikanUpcoming },
  { key: "top-tv", title: "Top Series on MAL", fetcher: jikanTopTv, rank: true },
  { key: "top-movies", title: "Top Movies on MAL", fetcher: jikanTopMovies },
  { key: "popular", title: "Most Popular on MAL", fetcher: jikanTopPopular },
  { key: "all-time", title: "Top Rated on MAL", fetcher: jikanTopAnime },
  { key: "gems", title: "Hidden Gems on MAL", fetcher: jikanUnderratedGems },
  {
    key: "era-2020s",
    title: "2020s Hits",
    fetcher: (p) => jikanByEra("2020-01-01", "2029-12-31", p),
  },
  {
    key: "era-2010s",
    title: "2010s Classics",
    fetcher: (p) => jikanByEra("2010-01-01", "2019-12-31", p),
  },
  {
    key: "era-2000s",
    title: "2000s Era",
    fetcher: (p) => jikanByEra("2000-01-01", "2009-12-31", p),
  },
  {
    key: "era-1990s",
    title: "Foundation Years (90s)",
    fetcher: (p) => jikanByEra("1990-01-01", "1999-12-31", p),
  },
  { key: "genre-action", title: "Action & Adventure", fetcher: (p) => jikanByGenre(GENRE.Action, p) },
  { key: "genre-romance", title: "Romance", fetcher: (p) => jikanByGenre(GENRE.Romance, p) },
  { key: "genre-slice", title: "Slice of Life", fetcher: (p) => jikanByGenre(GENRE.SliceOfLife, p) },
  { key: "genre-mecha", title: "Mecha", fetcher: (p) => jikanByGenre(GENRE.Mecha, p) },
  { key: "genre-fantasy", title: "Fantasy", fetcher: (p) => jikanByGenre(GENRE.Fantasy, p) },
  { key: "genre-scifi", title: "Sci-Fi", fetcher: (p) => jikanByGenre(GENRE.SciFi, p) },
  { key: "genre-psych", title: "Psychological", fetcher: (p) => jikanByGenre(GENRE.Psychological, p) },
  { key: "genre-horror", title: "Horror & Supernatural", fetcher: (p) => jikanByGenre(GENRE.Horror, p) },
];

const HERO_KEYS = new Set(["airing", "top-airing", "upcoming", "popular"]);
const TOP_PICKS_KEY = "top-airing";

type RowState = { metas: Meta[]; page: number; hasMore: boolean; ready: boolean };

const EMPTY_ROW: RowState = { metas: [], page: 1, hasMore: false, ready: false };

function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

export function isAnimeRow(row: AddonRow): boolean {
  if (row.type === "anime") return true;
  const nameLower = (row.name ?? "").toLowerCase();
  if (/\b(anime|mal|anilist|kitsu|aniworld|crunchyroll|funimation)\b/.test(nameLower)) return true;
  const sample = row.metas.slice(0, 6);
  if (sample.length === 0) return false;
  const animeIds = sample.filter(
    (m) => m.id.startsWith("kitsu:") || m.id.startsWith("mal:") || m.id.startsWith("anilist:"),
  ).length;
  return animeIds / sample.length >= 0.5;
}

export function AnimeView({ active = true }: { active?: boolean }) {
  const [rowsByKey, setRowsByKey] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const s of SPECS) init[s.key] = EMPTY_ROW;
    return init;
  });
  const rowsRef = useRef(rowsByKey);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rowsByKey;
  }, [rowsByKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const BATCH = 6;
      const GAP_MS = 350;
      for (let i = 0; i < SPECS.length; i += BATCH) {
        if (cancelled) return;
        const batch = SPECS.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (s) => {
            try {
              const metas = await s.fetcher(1);
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas, page: 1, hasMore: metas.length >= 20, ready: true },
              }));
            } catch {
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas: [], page: 1, hasMore: false, ready: true },
              }));
            }
          }),
        );
        if (i + BATCH < SPECS.length) {
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback((key: string) => {
    if (loadingRef.current.has(key)) return;
    const spec = SPECS.find((s) => s.key === key);
    const row = rowsRef.current[key];
    if (!spec || !row || !row.hasMore || row.metas.length >= 80) return;
    loadingRef.current.add(key);
    const next = row.page + 1;
    spec
      .fetcher(next)
      .then((more) => {
        setRowsByKey((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const ids = new Set(cur.metas.map((m) => m.id));
          const fresh = more.filter((m) => !ids.has(m.id));
          return {
            ...prev,
            [key]: {
              ...cur,
              metas: [...cur.metas, ...fresh],
              page: next,
              hasMore: more.length >= 20 && cur.metas.length + fresh.length < 80,
            },
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(key);
      });
  }, []);

  const heroMetas = useMemo<Meta[]>(() => {
    const allWithBg = new Map<string, Meta>();
    for (const spec of SPECS) {
      const r = rowsByKey[spec.key];
      if (!r || !r.ready) continue;
      for (const m of r.metas) {
        if (m.background && !allWithBg.has(m.id)) allWithBg.set(m.id, m);
      }
    }
    const winners: { meta: Meta; year: number }[] = [];
    for (const m of allWithBg.values()) {
      const win = findTopAward(m.name, parseAwardYear(m.releaseInfo));
      if (win) winners.push({ meta: m, year: win.year });
    }
    winners.sort((a, b) => b.year - a.year);

    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const w of winners) {
      if (out.length >= 3) break;
      if (seen.has(w.meta.id)) continue;
      seen.add(w.meta.id);
      out.push(cleanMeta(w.meta));
    }
    for (const spec of SPECS) {
      if (out.length >= 4) break;
      if (!HERO_KEYS.has(spec.key)) continue;
      const r = rowsByKey[spec.key];
      if (!r || !r.ready) continue;
      const pick = r.metas.find((m) => m.background && !seen.has(m.id));
      if (!pick) continue;
      seen.add(pick.id);
      out.push(cleanMeta(pick));
    }
    return out;
  }, [rowsByKey]);

  const { settings, update } = useSettings();
  const favoriteGenres = settings.animeFavoriteGenres;
  const anilistHidden = settings.animeAnilistRowsHidden;
  const [showPicker, setShowPicker] = useState(false);

  const { authKey } = useAuth();
  const [libItems, setLibItems] = useState<LibraryItem[]>([]);
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  useEffect(() => {
    if (!authKey) {
      setLibItems([]);
      setAddonRows([]);
      return;
    }
    library(authKey)
      .then(setLibItems)
      .catch(() => setLibItems([]));
    loadAddonRows(authKey)
      .then((rows) => setAddonRows(rows.filter(isAnimeRow)))
      .catch(() => setAddonRows([]));
  }, [authKey]);

  const continueWatching = useMemo(() => {
    return libItems
      .filter(
        (i) =>
          (!i.removed || i.temp) &&
          i.state &&
          i.state.timeOffset > 0 &&
          (i._id.startsWith("kitsu:") || i._id.startsWith("mal:")),
      )
      .sort((a, b) => Date.parse(b._mtime) - Date.parse(a._mtime))
      .slice(0, 20);
  }, [libItems]);

  const watchHistoryRecs = useWatchHistoryRecommendations(continueWatching);

  const topPicks = useAnimeTopPicks({
    libItems,
    continueWatching,
    heroMetas,
    watchHistoryRecs,
    favoriteGenres,
  });

  const awardWinnerEntries = useCrunchyrollAwardMetas();
  const awardWinnersRaw = useMemo(() => {
    const winByKey = uniqueWinnerFranchisesAcrossSources();
    const seen = new Set<string>();
    const out: Array<{ meta: Meta; year: number; lookupName: string }> = [];

    for (const spec of SPECS) {
      const r = rowsByKey[spec.key];
      if (!r?.ready) continue;
      for (const m of r.metas) {
        const fk = animeFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        const win = winByKey.get(fk);
        if (!win) continue;
        seen.add(fk);
        out.push({ meta: cleanMeta(m), year: win.year, lookupName: win.title });
      }
    }

    for (const e of awardWinnerEntries) {
      const fk = animeFranchiseKey(e.meta.name);
      if (seen.has(fk)) continue;
      seen.add(fk);
      out.push({ meta: cleanMeta(e.meta), year: e.win.year, lookupName: e.win.title });
    }

    out.sort((a, b) => b.year - a.year);
    return out;
  }, [rowsByKey, awardWinnerEntries]);
  const awardWinnerMetas = useMemo<Meta[]>(
    () => awardWinnersRaw.map((x) => x.meta),
    [awardWinnersRaw],
  );
  const awardLookupByMetaId = useMemo(() => {
    const out: Record<string, string> = {};
    for (const x of awardWinnersRaw) out[x.meta.id] = x.lookupName;
    return out;
  }, [awardWinnersRaw]);

  const filteredRowsByKey = useMemo<Record<string, RowState>>(() => {
    const seen = new Set<string>();
    for (const m of heroMetas) seen.add(animeFranchiseKey(m.name));
    for (const m of topPicks) seen.add(animeFranchiseKey(m.name));
    const out: Record<string, RowState> = {};
    for (const spec of SPECS) {
      const row = rowsByKey[spec.key];
      if (!row) {
        out[spec.key] = EMPTY_ROW;
        continue;
      }
      if (spec.key === "upcoming" || !row.ready) {
        out[spec.key] = row;
        continue;
      }
      const filtered: Meta[] = [];
      for (const m of row.metas) {
        const fk = animeFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        seen.add(fk);
        filtered.push(cleanMeta(m));
      }
      out[spec.key] = { ...row, metas: filtered };
    }
    return out;
  }, [rowsByKey, heroMetas, topPicks]);

  const dedupedAddonRows = useMemo(() => {
    const seen = new Set<string>();
    for (const s of SPECS) seen.add(normalizeName(s.title, "anime"));
    const out: AddonRow[] = [];
    for (const r of addonRows) {
      const key = normalizeName(r.name, "anime");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        settings.hideContent.adult
          ? { ...r, metas: r.metas.filter((m) => !isAdultAnime(m)) }
          : r,
      );
    }
    return out;
  }, [addonRows, settings.hideContent.adult]);

  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("anime", scrollRef, active);

  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      const fire = () =>
        window.dispatchEvent(
          new CustomEvent("harbor:reset-row-scrolls", { detail: { prefix: "anime:" } }),
        );
      fire();
      const r1 = requestAnimationFrame(fire);
      const r2 = window.setTimeout(fire, 80);
      prevActiveRef.current = active;
      return () => {
        cancelAnimationFrame(r1);
        window.clearTimeout(r2);
      };
    }
    prevActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ anchor: string }>).detail;
      const anchor = detail?.anchor;
      if (!anchor) return;
      const root = scrollRef.current;
      if (!root) return;
      const tryScroll = () => {
        const el = root.querySelector<HTMLElement>(`[data-scroll-anchor="${anchor}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return true;
        }
        return false;
      };
      if (tryScroll()) return;
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        if (tryScroll() || attempts > 20) window.clearInterval(id);
      }, 150);
    };
    window.addEventListener("harbor:anime-focus-row", handler as EventListener);
    return () => window.removeEventListener("harbor:anime-focus-row", handler as EventListener);
  }, []);

  return (
    <main
      ref={scrollCb}
      className="flex-1 overflow-y-auto px-12 pt-28 pb-14"
    >
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="flex flex-col gap-12">
          {heroMetas.length > 0 && (
            <div data-scroll-anchor="hero" className="relative">
              <AnimeHero slides={heroMetas} topPicks={topPicks} />
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                title="Tune your Top Picks"
                className="absolute right-4 top-4 z-10 flex h-9 items-center gap-1.5 rounded-full border border-edge-soft/60 bg-canvas/80 px-3 text-[12px] font-semibold text-ink-muted shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:border-accent/50 hover:text-accent"
              >
                <Sparkles size={13} strokeWidth={2.1} />
                Tune picks
                {favoriteGenres.length > 0 && (
                  <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-bold text-accent">
                    {favoriteGenres.length}
                  </span>
                )}
              </button>
            </div>
          )}
          {!anilistHidden.includes("yourLists") && <AnilistRows />}
          {continueWatching.length > 0 && (
            <Row title="Continue Watching" min={260} shape="landscape" scrollKey="anime:cw">
              {continueWatching.map((item) => (
                <ContinueCard key={item._id} item={item} />
              ))}
            </Row>
          )}
          <AnilistRowControls />
          {!anilistHidden.includes("trending") && <AnilistTrendingRow />}
          {!anilistHidden.includes("top100") && <AnilistTopRow />}
          {awardWinnerMetas.length > 0 && (
            <div data-scroll-anchor="row:anime-awards">
              <Row title="Award Winning Anime" scrollKey="anime:awards">
                {awardWinnerMetas.map((m) => (
                  <PickCard key={m.id} meta={m} awardLookupName={awardLookupByMetaId[m.id]} />
                ))}
              </Row>
            </div>
          )}
          {SPECS.map((spec) => {
            if (spec.key === TOP_PICKS_KEY) return null;
            const r = filteredRowsByKey[spec.key] ?? EMPTY_ROW;
            if (r.ready && r.metas.length === 0) return null;
            return (
              <div key={spec.key} data-scroll-anchor={`row:${spec.key}`}>
                {!r.ready ? (
                  <RowSkeleton title={spec.rank ? `Top 10 ${spec.title.replace(/^Top\s*/i, "")}` : spec.title} />
                ) : spec.rank && r.metas.length >= 10 ? (
                  <Row
                    title={`Top 10 ${spec.title.replace(/^Top\s*/i, "")}`}
                    min={180}
                    shape="rank"
                    scrollKey={`anime:${spec.key}`}
                  >
                    {r.metas.slice(0, 10).map((m, i) => (
                      <AnimeRankCard key={m.id} meta={m} rank={i + 1} />
                    ))}
                  </Row>
                ) : (
                  <Row
                    title={spec.title}
                    scrollKey={`anime:${spec.key}`}
                    onEndReached={r.hasMore ? () => loadMore(spec.key) : undefined}
                  >
                    {r.metas.map((m, i) => (
                      <PickCard key={`${m.id}-${i}`} meta={m} />
                    ))}
                  </Row>
                )}
              </div>
            );
          })}
          {dedupedAddonRows.map((row) => (
            <div key={row.key} data-scroll-anchor={`row:${row.key}`}>
              <Row title={row.name} scrollKey={`anime:addon:${row.key}`}>
                {row.metas.map((m, i) => (
                  <PickCard key={`${m.id}-${i}`} meta={cleanMeta(m)} />
                ))}
              </Row>
            </div>
          ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
      {showPicker && (
        <AnimeGenrePicker
          initial={favoriteGenres}
          onSave={(g) =>
            update({ animeFavoriteGenres: g, animePicksDismissedAt: Date.now() })
          }
          onClose={() => {
            setShowPicker(false);
            update({ animePicksDismissedAt: Date.now() });
          }}
        />
      )}
    </main>
  );
}

function RowSkeleton({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-[26px] font-medium text-ink/85">{title}</h2>
      </div>
      <div className="flex gap-5 overflow-hidden px-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 animate-pulse rounded-2xl bg-elevated/60"
            style={{ width: 144, aspectRatio: "2 / 3", animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

