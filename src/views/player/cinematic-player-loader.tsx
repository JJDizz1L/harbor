import { useEffect, useRef, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, usePlaybackFlag } from "@/lib/player/playback-clock";
import { isLocalUrl } from "@/lib/player/local-url";
import type { PlayerSrc } from "@/lib/view";
import { LoaderLogoOrText } from "./loader-logo-or-text";
import { readinessScore, type EngineStats } from "@/lib/torrent/engine-stats";
import { isBundledEngineUrl } from "@/lib/stremio-server";

export function CinematicPlayerLoader({
  src,
  snap,
  forceShow,
  onCancel,
  engineStats,
}: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  forceShow?: boolean;
  onCancel: () => void;
  engineStats?: EngineStats | null;
}) {
  const isLocal = isLocalUrl(src.url);
  const isInfoHash = isBundledEngineUrl(src.url) && !src.url.includes("/hlsv2/");
  const pct = Math.round(readinessScore(engineStats ?? null, isInfoHash));
  const everPlayedRef = useRef(false);
  const hasProgress = usePlaybackFlag(() => getPlaybackPosition() > 0.3);
  if (snap.durationSec > 0 && hasProgress) {
    everPlayedRef.current = true;
  }
  const sessionKey = `${src.meta.id}::${src.episode?.season ?? ""}:${src.episode?.episode ?? ""}`;
  const lastSessionRef = useRef(sessionKey);
  if (lastSessionRef.current !== sessionKey) {
    lastSessionRef.current = sessionKey;
    everPlayedRef.current = false;
  }
  const showing =
    forceShow ||
    (!everPlayedRef.current && snap.errorCode == null && snap.status !== "ended");
  const [mounted, setMounted] = useState(showing);
  useEffect(() => {
    if (showing) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [showing]);
  if (!mounted) return null;
  const backdrop = src.episode?.still || src.meta.background || src.meta.poster;
  return (
    <div
      data-tauri-drag-region
      className={`absolute inset-0 z-10 overflow-hidden bg-black transition-opacity duration-300 ${
        showing ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[28px] saturate-150"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/85" />
      <div
        data-tauri-drag-region
        className="relative flex h-full flex-col items-center justify-center gap-7 px-8 text-center"
      >
        <LoaderLogoOrText
          logo={src.meta.logo ?? null}
          fallbackText={src.meta.name ?? src.title}
        />
        {src.episode && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.32em] text-white/70">
            S{src.episode.season} · E{String(src.episode.episode).padStart(2, "0")}
            {src.episode.name ? ` · ${src.episode.name}` : ""}
          </p>
        )}
        {isInfoHash ? (
          <div className="flex w-full max-w-[360px] flex-col items-center gap-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-white/85 transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[12.5px] font-medium tracking-wide text-white/55">
              {snap.buffering ? "Buffering" : "Preparing stream"}
              {engineStats ? ` (${pct}%)` : ""}
            </p>
          </div>
        ) : (
          <HarborLoader size="md" caption={isLocal ? "Loading" : "Connecting"} />
        )}
      </div>
      <button
        onClick={onCancel}
        className="absolute bottom-10 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-6 text-[13.5px] font-medium text-white/70 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Cancel
      </button>
    </div>
  );
}
