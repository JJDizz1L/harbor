import { useEffect, useRef, useState } from "react";
import type { ScoredStream } from "@/lib/streams/types";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import { hasInstantMarker, streamMatchesLangs } from "./picker-utils";
import { diag } from "@/lib/auto-play-diag";

const AUTO_SETTLE_MS = 1500;
const AUTO_SETTLE_PACK_MS = 4000;
const HIGH_CONFIDENCE_GRACE_MS = 350;
const HOST_SOURCE_WAIT_MS = 12_000;

export function useAutoFire(args: {
  autoActive: boolean;
  rememberedHandledFirst?: boolean;
  attempt?: number;
  autoCandidates: ScoredStream[];
  resolving: unknown;
  autoAttemptIdx: number;
  autoSettleReady: boolean;
  pipelineDone: boolean;
  firstResultAt: number | null;
  isCached: (s: ScoredStream) => boolean;
  p2pAutoConsent: boolean;
  preferredLangs: string[];
  hasDebrids: boolean;
  hasStrongAddon: boolean;
  isTorrentioStream: (s: ScoredStream) => boolean;
  expectHostSource?: boolean;
  hostSource?: SourceDescriptor | null;
  season?: number | null;
  episode?: number | null;
  autoFiredRef: React.MutableRefObject<boolean>;
  setAutoSettleReady: (v: boolean) => void;
  setAutoCancelled: (v: boolean) => void;
  onPlay: (s: ScoredStream, committed: boolean, skipP2pConfirm?: boolean, auto?: boolean) => void;
}): void {
  const {
    autoActive,
    rememberedHandledFirst,
    attempt,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady,
    pipelineDone,
    firstResultAt,
    isCached,
    p2pAutoConsent,
    preferredLangs,
    hasDebrids,
    hasStrongAddon,
    isTorrentioStream,
    expectHostSource,
    hostSource,
    season,
    episode,
    autoFiredRef,
    setAutoSettleReady,
    setAutoCancelled,
    onPlay,
  } = args;
  const exactEpisode = (s: ScoredStream) =>
    episode == null ||
    (s.episode === episode && (season == null || s.season == null || s.season === season));
  const highConfidenceSinceRef = useRef<number | null>(null);
  const [highConfidenceTick, setHighConfidenceTick] = useState(0);

  const [hostWaitElapsed, setHostWaitElapsed] = useState(false);
  useEffect(() => {
    if (!autoActive || !expectHostSource || hostSource || hostWaitElapsed) return;
    const t = window.setTimeout(() => setHostWaitElapsed(true), HOST_SOURCE_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [autoActive, expectHostSource, hostSource, hostWaitElapsed]);
  const waitingForHostSource = !!expectHostSource && !hostSource && !hostWaitElapsed;

  useEffect(() => {
    if (waitingForHostSource) return;
    if (!autoActive || autoFiredRef.current || pipelineDone || autoSettleReady) return;
    const top = autoCandidates[0];
    const langOk =
      preferredLangs.length === 0 || (top != null && streamMatchesLangs(top, preferredLangs));
    if (
      !top ||
      !hasInstantMarker(top) ||
      !isCached(top) ||
      !langOk ||
      !exactEpisode(top) ||
      (hasStrongAddon && isTorrentioStream(top))
    ) {
      highConfidenceSinceRef.current = null;
      return;
    }
    const t = window.setTimeout(
      () => setHighConfidenceTick((n) => n + 1),
      HIGH_CONFIDENCE_GRACE_MS + 20,
    );
    return () => window.clearTimeout(t);
  }, [
    autoActive,
    pipelineDone,
    autoSettleReady,
    autoCandidates,
    isCached,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    autoFiredRef,
    waitingForHostSource,
  ]);

  useEffect(() => {
    if (!autoActive || autoSettleReady || pipelineDone) return;
    if (firstResultAt == null) return;
    const hasCachedExact = autoCandidates.some((c) => isCached(c) && exactEpisode(c));
    const settleMs = episode != null && !hasCachedExact ? AUTO_SETTLE_PACK_MS : AUTO_SETTLE_MS;
    const elapsed = performance.now() - firstResultAt;
    const remaining = Math.max(0, settleMs - elapsed);
    const t = window.setTimeout(() => setAutoSettleReady(true), remaining);
    return () => window.clearTimeout(t);
  }, [
    autoActive,
    autoSettleReady,
    pipelineDone,
    firstResultAt,
    setAutoSettleReady,
    autoCandidates,
    isCached,
    episode,
  ]);

  useEffect(() => {
    if (!autoActive || autoFiredRef.current) {
      diag("auto-fire skip: autoActive=", autoActive, "autoFired=", autoFiredRef.current);
      return;
    }
    if (rememberedHandledFirst) {
      diag("auto-fire skip: rememberedHandledFirst");
      return;
    }
    if (waitingForHostSource) {
      diag("auto-fire skip: waitingForHostSource");
      return;
    }
    diag(
      "auto-fire candidates=",
      autoCandidates.length,
      "pipelineDone=",
      pipelineDone,
      "settleReady=",
      autoSettleReady,
      "resolving=",
      !!resolving,
      "attemptIdx=",
      autoAttemptIdx,
    );
    const top = autoCandidates[0];
    const isFirstAttempt = (attempt ?? 0) === 0 && autoAttemptIdx === 0;
    const langOk =
      preferredLangs.length === 0 || (top != null && streamMatchesLangs(top, preferredLangs));
    const highConfidenceTop =
      top != null &&
      hasInstantMarker(top) &&
      isCached(top) &&
      langOk &&
      exactEpisode(top) &&
      (!hasStrongAddon || !isTorrentioStream(top));
    if (isFirstAttempt && !pipelineDone) {
      if (highConfidenceTop) {
        const now = performance.now();
        if (highConfidenceSinceRef.current == null) highConfidenceSinceRef.current = now;
        if (now - highConfidenceSinceRef.current < HIGH_CONFIDENCE_GRACE_MS) {
          diag("auto-fire high-confidence grace period");
          return;
        }
      } else {
        highConfidenceSinceRef.current = null;
        if (!autoSettleReady) {
          diag("auto-fire waiting for autoSettleReady");
          return;
        }
      }
    }
    if (autoCandidates.length === 0) {
      diag("auto-fire no candidates");
      return;
    }
    if (resolving) {
      diag("auto-fire resolving in progress");
      return;
    }
    const idx = Math.min((attempt ?? 0) + autoAttemptIdx, autoCandidates.length - 1);
    const pick = autoCandidates[idx];
    if (!pick) {
      diag("auto-fire pick is null at idx=", idx);
      return;
    }
    const pickInstant = isCached(pick) || !!pick.url || (p2pAutoConsent && engineP2pEligible(pick));
    if (!pickInstant) {
      if (hasDebrids) {
        diag("auto-fire pick not instant, cancelling (hasDebrids)");
        if (pipelineDone) setAutoCancelled(true);
        return;
      }
      diag("auto-fire pick not instant but hasDebrids=false — proceeding");
    }
    autoFiredRef.current = true;
    const p2pConsentPick =
      !isCached(pick) && !pick.url && p2pAutoConsent && engineP2pEligible(pick);
    diag(
      "auto-fire FIRING idx=",
      idx,
      "pickInstant=",
      pickInstant,
      "url=",
      !!pick.url,
      "infoHash=",
      !!pick.infoHash,
    );
    onPlay(pick, p2pConsentPick, p2pConsentPick, true);
  }, [
    autoActive,
    rememberedHandledFirst,
    attempt,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady,
    pipelineDone,
    isCached,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    autoFiredRef,
    setAutoCancelled,
    onPlay,
    highConfidenceTick,
    waitingForHostSource,
  ]);
}
