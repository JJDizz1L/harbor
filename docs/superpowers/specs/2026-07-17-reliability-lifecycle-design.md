# Reliability Lifecycle Design

## Goal

Eliminate the identified resource-lifecycle failures without changing Harbor's public playback and casting behavior.

## Scope and Delivery Order

1. HLS sessions own their exact ffmpeg child and expose an idempotent async stop path. `cast_stop` stops the active HLS session directly. HLS uses a bounded sliding playlist.
2. Thumbnail caching becomes a bounded, byte-accounted LRU while keeping the existing data-URL command contract.
3. Windows multiview IPC uses bounded delivery and an incremental, size-limited parser.
4. mpv error handling uses testable exponential-backoff state and terminates after persistent failures.
5. Thumbnail and DVR state extraction happens before asynchronous cleanup; torrent sweeping moves off the initialization path and reports summary statistics.
6. macOS render ownership remains main-thread-only. The patch removes the stale-render leak only where synchronous main-thread teardown proves safe; it does not redesign the renderer or move to Metal.

## HLS Ownership

`HlsState` removes a session from its map before stopping it. The removed `Arc<HlsSession>` owns a lock-protected child handle and temporary directory; concurrent stop and eviction calls therefore operate on at most one removed session. HTTP handlers obtain an `Arc` before shutdown begins, so an in-flight request can fail normally if the removed temporary files disappear.

The ffmpeg HLS output uses a small sliding list with deletion enabled. A deleted segment request returns the existing retry/availability response rather than panicking. Idle eviction remains a safety net, while `cast_stop` is the primary teardown path.

## Bounded State

Thumbnails use an in-module LRU with explicit byte and entry budgets. Windows IPC uses a bounded Tokio channel and a capped incremental byte buffer. Lifecycle/error events are preserved by awaiting bounded delivery; replaceable traffic may be coalesced or dropped under saturation.

## Validation

Unit tests cover deterministic cache, parser, and backoff state. Existing Rust checks, Rust tests, frontend type checks, and formatting run after implementation. Platform-specific process and AppKit behavior remains validated by compilation plus targeted lifecycle logic because real ffmpeg/mpv/AppKit integration cannot run reliably in unit tests.
