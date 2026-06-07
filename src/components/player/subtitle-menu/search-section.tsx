import { Loader2, Search as SearchIcon, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Flag } from "@/components/flag";
import { useAuth } from "@/lib/auth";
import { userAddons, type Addon } from "@/lib/addons";
import { languageName } from "@/lib/subtitles/language";
import { searchSubtitles } from "@/lib/subtitles/search";
import type { SubResult } from "@/lib/subtitles/types";
import { useSettings } from "@/lib/settings";
import type { SubtitleMenuProps } from "./types";
import { isVeryNewRelease } from "./utils";

export function SearchSection(props: SubtitleMenuProps) {
  const { metaImdbId, metaTitle, season, episode, onAddSubtitle } = props;
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const [query, setQuery] = useState(
    metaTitle && season != null && episode != null
      ? `${metaTitle} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : (metaTitle ?? ""),
  );
  const [results, setResults] = useState<SubResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideHI, setHideHI] = useState(false);
  const [forcedOnly, setForcedOnly] = useState(false);
  const [addons, setAddons] = useState<Addon[] | null>(null);

  useEffect(() => {
    if (!authKey) {
      setAddons([]);
      return;
    }
    let cancelled = false;
    userAddons(authKey)
      .then((a) => {
        if (!cancelled) setAddons(a);
      })
      .catch(() => {
        if (!cancelled) setAddons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => {
    if (!metaImdbId || results !== null) return;
    void run();
  }, [metaImdbId]);

  const run = async () => {
    setLoading(true);
    setResults(null);
    try {
      const enabled = settings.subProvidersEnabled ?? {};
      const r = await searchSubtitles(
        {
          imdbId: metaImdbId ?? undefined,
          title: !metaImdbId ? query : undefined,
          season: season ?? undefined,
          episode: episode ?? undefined,
          langs: settings.preferredSubLangs ?? [],
        },
        {
          providers: {
            wyzie: enabled.wyzie === true,
            addons: enabled.addons ?? true,
            opensubtitles: enabled.opensubtitles ?? true,
          },
          addons: addons ?? [],
          preferredLangs: settings.preferredSubLangs ?? [],
        },
      );
      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!results) return null;
    return results.filter((r) => {
      if (hideHI && r.hearingImpaired) return false;
      if (forcedOnly && !r.forced) return false;
      return true;
    });
  }, [results, hideHI, forcedOnly]);

  const grouped = useMemo(() => {
    if (!filtered) return [] as Array<{ lang: string; items: SubResult[] }>;
    const m = new Map<string, SubResult[]>();
    for (const r of filtered) {
      const key = languageName(r.lang);
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return [...m.entries()].map(([lang, items]) => ({ lang, items }));
  }, [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <SearchIcon
            size={14}
            strokeWidth={2.2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder={metaImdbId ? "Refine search" : "Title"}
            className="h-9 w-full rounded-lg border border-edge-soft bg-canvas/60 pl-9 pr-3 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
          />
        </div>
        <button
          onClick={() => void run()}
          disabled={loading || (!metaImdbId && !query.trim())}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-elevated px-4 text-[13px] font-semibold text-ink ring-1 ring-edge transition-colors hover:bg-raised disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : "Search"}
        </button>
      </div>

      {results && results.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2.5">
          <FilterChip active={!hideHI} onClick={() => setHideHI((v) => !v)}>
            Show HI/SDH
          </FilterChip>
          <FilterChip active={forcedOnly} onClick={() => setForcedOnly((v) => !v)}>
            Forced only
          </FilterChip>
          <span className="ml-auto text-[11.5px] tabular-nums text-ink-subtle">
            {filtered?.length ?? 0} of {results.length}
          </span>
        </div>
      )}

      {loading && results == null && (
        <p className="px-4 py-3 text-[13px] text-ink-muted">Searching…</p>
      )}
      {results !== null && results.length === 0 && (
        <p className="px-4 py-3 text-[13px] text-ink-muted">
          {isVeryNewRelease(props.metaReleaseDate)
            ? "Movie's too new. Subtitles haven't been published yet."
            : "No subtitles found."}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.map(({ lang, items }) => (
          <div key={lang} className="border-t border-edge-soft/60">
            <div className="flex items-center gap-2 bg-canvas/40 px-4 py-1.5">
              <Flag language={lang} size="sm" showLabel={false} />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                {lang}
              </span>
              <span className="text-[11px] tabular-nums text-ink-subtle">{items.length}</span>
            </div>
            {items.slice(0, 30).map((r) => (
              <button
                key={r.id}
                onClick={() => onAddSubtitle(r.url, r.lang, r.title)}
                className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas/60"
              >
                <Download
                  size={13}
                  strokeWidth={2.2}
                  className="mt-1 shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] text-ink">{r.title || lang}</span>
                  <span className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
                    <span className="capitalize">{r.source}</span>
                    {r.format && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="uppercase">{r.format}</span>
                      </>
                    )}
                    {typeof r.downloads === "number" && r.downloads > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{compactNumber(r.downloads)} dl</span>
                      </>
                    )}
                    {r.hearingImpaired && (
                      <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
                        HI/SDH
                      </span>
                    )}
                    {r.forced && (
                      <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200">
                        Forced
                      </span>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-semibold transition-colors ${
        active
          ? "bg-elevated text-ink ring-1 ring-edge"
          : "bg-raised text-ink-muted hover:bg-elevated/80"
      }`}
    >
      {children}
    </button>
  );
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
