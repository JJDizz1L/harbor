import { ArrowDownToLine, Check, RotateCw, X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor, cancelDownload, useDownloads } from "@/lib/download/downloads-store";
import { useView, type PlayEpisode } from "@/lib/view";

export function EpisodeDownloadButton({
  meta,
  episode,
  size = 40,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  size?: number;
}) {
  const { openPicker } = useView();
  useDownloads();
  const dl = activeDownloadFor(meta.id, episode?.season ?? null, episode?.episode ?? null);
  const status = dl?.status;
  const downloading = status === "downloading";
  const done = status === "done";
  const failed = status === "error";
  const persistent = downloading || done || failed;
  const ratio = dl?.ratio ?? 0;
  const pct = Math.round(ratio * 100);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading && dl) {
      cancelDownload(dl.id);
      return;
    }
    openPicker(meta, episode, { intent: "download" });
  };

  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = size >= 38 ? 2.5 : 2.2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        downloading
          ? `Downloading ${pct} percent, click to cancel`
          : done
            ? "Saved offline"
            : failed
              ? "Download failed, click to retry"
              : "Download for offline"
      }
      title={
        downloading
          ? `Downloading ${pct}%  ·  click to cancel`
          : done
            ? "Saved offline"
            : failed
              ? "Download failed  ·  click to retry"
              : "Download for offline"
      }
      className={`group/dl relative flex shrink-0 items-center justify-center self-start rounded-full transition-[opacity,background-color,transform] duration-200 ease-out ${
        persistent
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${
        done
          ? "text-emerald-300"
          : failed
            ? "text-danger hover:bg-danger/10"
            : "text-ink-subtle hover:bg-elevated hover:text-ink active:scale-90"
      }`}
      style={{ width: size, height: size }}
    >
      {downloading ? (
        <>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              className="text-ink"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              className="text-accent transition-[stroke-dashoffset] duration-500 ease-out"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(1, Math.max(0.03, ratio)))}
            />
          </svg>
          <span className="absolute text-[9.5px] font-semibold tabular-nums text-ink-muted transition-opacity duration-150 group-hover/dl:opacity-0">
            {pct}
          </span>
          <X
            size={size * 0.34}
            strokeWidth={2.6}
            className="absolute text-ink opacity-0 transition-opacity duration-150 group-hover/dl:opacity-100"
          />
        </>
      ) : done ? (
        <Check size={size * 0.46} strokeWidth={2.6} />
      ) : failed ? (
        <RotateCw size={size * 0.42} strokeWidth={2.2} />
      ) : (
        <ArrowDownToLine size={size * 0.46} strokeWidth={2} />
      )}
    </button>
  );
}
