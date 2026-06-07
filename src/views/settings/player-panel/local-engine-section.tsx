import { Check, Loader2, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  torrentEngineSelfTest as engineSelfTest,
  torrentEngineStatus as engineStatus,
  type EngineStatus,
} from "@/lib/torrent/local-engine";

type SelfTestResult = Awaited<ReturnType<typeof engineSelfTest>>;

type EngineState = "running" | "stopped" | "error";

const PILL: Record<EngineState, { label: string; dot: string; chip: string }> = {
  running: { label: "Running", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-400" },
  stopped: { label: "Stopped", dot: "bg-ink-subtle", chip: "bg-ink-subtle/15 text-ink-muted" },
  error: { label: "Error", dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

function engineState(status: EngineStatus | null): EngineState {
  if (status?.last_error) return "error";
  if (status?.ready) return "running";
  return "stopped";
}

export function LocalEngineSection() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SelfTestResult | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const next = await engineStatus();
      if (alive) setStatus(next);
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const runTest = async () => {
    setRunning(true);
    try {
      setResult(await engineSelfTest());
    } finally {
      setRunning(false);
    }
  };

  const pill = PILL[engineState(status)];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">Local engine</span>
          <span className="text-[12.5px] text-ink-subtle">
            Built-in peer-to-peer streaming, served from your own machine.
          </span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${pill.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink-subtle">
        <span>
          Port <span className="font-mono text-accent">{status?.port ?? "n/a"}</span>
        </span>
        <span>
          Active torrents <span className="font-mono text-accent">{status?.active_torrents ?? 0}</span>
        </span>
      </div>

      {status?.last_error && (
        <p className="text-[12px] leading-relaxed text-danger">{status.last_error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
        >
          {running ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Play size={14} strokeWidth={2.4} />
          )}
          {running ? "Running self-test" : "Run self-test"}
        </button>
      </div>

      {result && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-edge-soft bg-canvas/40 p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Self-test
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                result.pass ? "bg-emerald-500/15 text-emerald-400" : "bg-danger/15 text-danger"
              }`}
            >
              {result.pass ? (
                <Check size={12} strokeWidth={2.8} />
              ) : (
                <X size={12} strokeWidth={2.8} />
              )}
              {result.pass ? "Pass" : "Fail"}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {result.steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2.5 text-[12.5px]">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center ${
                    step.ok ? "text-emerald-400" : "text-danger"
                  }`}
                >
                  {step.ok ? (
                    <Check size={13} strokeWidth={2.8} />
                  ) : (
                    <X size={13} strokeWidth={2.8} />
                  )}
                </span>
                <span className="font-medium text-ink">{step.label}</span>
                {step.detail && (
                  <span className="ml-auto truncate pl-3 text-right font-mono text-[11.5px] text-ink-subtle">
                    {step.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
