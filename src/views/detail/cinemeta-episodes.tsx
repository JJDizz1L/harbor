import { ChevronDown, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { Poster } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { EpisodeDownloadButton } from "./episode-download-button";

type CinemetaVideo = NonNullable<Meta["videos"]>[number];

export function CinemetaEpisodes({
  meta,
  videos,
}: {
  meta: Meta;
  videos: NonNullable<Meta["videos"]>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, CinemetaVideo[]>();
    for (const v of videos) {
      if (v.season == null || v.episode == null) continue;
      if (v.season === 0) continue;
      const arr = map.get(v.season) ?? [];
      arr.push(v);
      map.set(v.season, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([s, eps]) => ({
        seasonNumber: s,
        episodes: eps.slice().sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
      }));
  }, [videos]);

  const latestSeason = grouped[grouped.length - 1]?.seasonNumber ?? 1;
  const [active, setActive] = useState<number>(latestSeason);

  useEffect(() => {
    setActive(grouped[grouped.length - 1]?.seasonNumber ?? 1);
  }, [meta.id, grouped.length]);

  if (grouped.length === 0) return null;
  const activeEps = grouped.find((g) => g.seasonNumber === active)?.episodes ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <h3 className="text-[22px] font-medium tracking-tight text-ink">Episodes</h3>
        {grouped.length > 1 && (
          <SeasonDropdown
            seasons={grouped.map((g) => g.seasonNumber)}
            active={active}
            onChange={setActive}
          />
        )}
      </div>
      <p className="text-[13px] text-ink-subtle">
        {activeEps.length} episode{activeEps.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-col gap-1">
        {activeEps.map((ep) => (
          <CinemetaEpisodeRow
            key={ep.id ?? `${ep.season}-${ep.episode}`}
            meta={meta}
            ep={ep}
          />
        ))}
      </div>
    </div>
  );
}

export function CinemetaEpisodeRow({ meta, ep }: { meta: Meta; ep: CinemetaVideo }) {
  const { openPicker } = useView();
  const { settings } = useSettings();
  const aired = ep.released ?? ep.firstAired ?? null;
  const playEpisode = {
    season: ep.season!,
    episode: ep.episode!,
    name: ep.name || ep.title || undefined,
    still: ep.thumbnail || undefined,
    overview: undefined,
  };
  return (
    <div
      data-no-card-ring
      className="group flex items-center gap-4 rounded-2xl px-4 py-5 transition-colors hover:bg-elevated/30"
    >
      <button
        onClick={() => openPicker(meta, playEpisode, { autoPlay: settings.instantPlay })}
        className="flex min-w-0 flex-1 gap-6 text-left"
      >
        <div className="relative w-[200px] shrink-0 overflow-hidden rounded-lg">
          <Poster
            src={ep.thumbnail}
            seed={`${meta.id}-${ep.season}-${ep.episode}`}
            ratio="landscape"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
          <span className="absolute left-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {ep.episode}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 className="truncate text-[16px] font-semibold text-ink">
            {ep.name || ep.title || `Episode ${ep.episode}`}
          </h4>
          <p className="text-[12px] text-ink-subtle">
            {[`S${ep.season} E${ep.episode}`, formatAired(aired)].filter(Boolean).join("  ·  ")}
          </p>
        </div>
      </button>
      <EpisodeDownloadButton meta={meta} episode={playEpisode} />
    </div>
  );
}

function SeasonDropdown({
  seasons,
  active,
  onChange,
}: {
  seasons: number[];
  active: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 pl-4 pr-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-canvas"
      >
        <span>Season {active}</span>
        <ChevronDown
          size={15}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-fade-in absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl">
          <div className="max-h-[60vh] overflow-y-auto">
            {seasons.map((s) => {
              const isActive = s === active;
              return (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-4 py-2.5 text-left text-[13.5px] transition-colors ${
                    isActive
                      ? "bg-ink/10 text-ink"
                      : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                  }`}
                >
                  Season {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatAired(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
