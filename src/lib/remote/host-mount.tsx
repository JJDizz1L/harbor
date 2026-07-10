import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { discoverCastDevices } from "@/lib/cast";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import {
  buildRemoteSnapshot,
  dispatchRemoteCommand,
  setRemoteCastDiscovering,
  setRemoteCastDevices,
  subscribeRemoteSession,
} from "./session";
import {
  REMOTE_PROTO,
  parseClientMessage,
  type RemoteServerMessage,
} from "./protocol";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function broadcast(msg: RemoteServerMessage) {
  if (!isTauri) return;
  void invoke("remote_ws_broadcast", { payload: JSON.stringify(msg) }).catch(() => {});
}

function pushSnapshot() {
  broadcast({ t: "snapshot", snapshot: buildRemoteSnapshot(getPlaybackPosition()) });
}

/**
 * Host-side remote control plane. Mount only in the Tauri desktop shell.
 * Relays WS commands to the active player/cast binding and pushes snapshots.
 */
export function RemoteHostMount() {
  const { settings } = useSettings();
  const enabled = settings.serveWebUi || settings.remoteControlEnabled;
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!isTauri || !enabled) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void listen<{ clientId: number; raw: string }>("remote://cmd", (e) => {
      const raw = e.payload?.raw;
      if (!raw) return;
      const msg = parseClientMessage(raw);
      if (!msg) {
        broadcast({ t: "error", message: "invalid message" });
        return;
      }
      if (msg.t === "hello") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
        return;
      }
      if (msg.t === "cmd") {
        void (async () => {
          try {
            if (msg.command.action === "castDiscover") {
              setRemoteCastDiscovering(true);
              try {
                const devices = await discoverCastDevices();
                setRemoteCastDevices(devices);
              } finally {
                setRemoteCastDiscovering(false);
              }
              pushSnapshot();
            } else if (msg.command.action === "ping") {
              broadcast({ t: "pong", at: Date.now() });
            } else if (msg.command.action === "nav") {
              // Nav is fire-and-forget into host focus; skip snapshot churn.
              await dispatchRemoteCommand(msg.command);
            } else {
              await dispatchRemoteCommand(msg.command);
              pushSnapshot();
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "remote command failed";
            broadcast({ t: "error", message });
            pushSnapshot();
          }
        })();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    void listen<{ action: string }>("remote://client", (e) => {
      if (e.payload?.action === "join") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    unsubs.push(subscribeRemoteSession(() => pushSnapshot()));
    unsubs.push(
      subscribePlaybackClock(() => {
        // throttle via shared interval below
      }),
    );

    setRemoteCastDiscovering(true);
    void discoverCastDevices().then((devices) => {
      if (!cancelled) {
        setRemoteCastDevices(devices);
      }
    }).finally(() => {
      if (!cancelled) setRemoteCastDiscovering(false);
    });

    timerRef.current = window.setInterval(() => {
      pushSnapshot();
    }, 400);

    pushSnapshot();

    return () => {
      cancelled = true;
      window.clearInterval(timerRef.current);
      for (const u of unsubs) u();
    };
  }, [enabled]);

  return null;
}
