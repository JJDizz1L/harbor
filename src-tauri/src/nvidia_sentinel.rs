//! Crash sentinel for NVIDIA + Wayland native rendering.
//!
//! Tier 1 checks the NVIDIA driver version and only enables native Wayland
//! for drivers >= 555.  This sentinel adds a second layer of defence: if the
//! app crashes on native Wayland, the sentinel file persists across restarts
//! and the next launch falls back to X11 automatically.
//!
//! Cove's GpuWorkaround documented a similar approach for QtWebEngine GPU
//! crashes and this module follows the same pattern.

use std::path::PathBuf;

const MAX_CRASHES: u32 = 2;

/// Directory used for the sentinel file, resolved without Tauri.
fn sentinel_dir() -> PathBuf {
    let base = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
            PathBuf::from(home).join(".local").join("share")
        });
    base.join("harbor")
}

fn sentinel_path() -> PathBuf {
    sentinel_dir().join("nvidia-wl-sentinel")
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Sentinel {
    crashes: u32,
    driver: u32,
}

/// Forces X11 when the sentinel shows too many consecutive crashes with the
/// same NVIDIA driver, indicating that native Wayland is unstable on this
/// hardware/driver combination.
///
/// Returns `true` when GDK_BACKEND should be forced to x11.
pub(crate) fn check_sentinel(driver_version: u32) -> bool {
    let path = sentinel_path();
    let prev: Option<Sentinel> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());

    let crashes = match prev {
        Some(s) if s.driver == driver_version => s.crashes + 1,
        _ => 1,
    };

    if crashes > MAX_CRASHES {
        eprintln!(
            "[harbor::nvidia_sentinel] {} consecutive crashes on NVIDIA {}; forcing X11 fallback",
            crashes, driver_version,
        );
        let _ = std::fs::create_dir_all(sentinel_dir());
        let _ = std::fs::write(
            &path,
            serde_json::to_string(&Sentinel {
                crashes,
                driver: driver_version,
            })
            .unwrap_or_default(),
        );
        return true;
    }

    let _ = std::fs::create_dir_all(sentinel_dir());
    let _ = std::fs::write(
        &path,
        serde_json::to_string(&Sentinel {
            crashes,
            driver: driver_version,
        })
        .unwrap_or_default(),
    );
    false
}

/// Called on clean app shutdown.  Removes the sentinel file so the next
/// startup has a clean slate (zero crashes).
pub(crate) fn mark_clean_exit() {
    let path = sentinel_path();
    if path.exists() {
        let _ = std::fs::remove_file(&path);
        eprintln!("[harbor::nvidia_sentinel] clean exit; sentinel removed");
    }
}
