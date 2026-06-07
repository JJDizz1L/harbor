import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useSettings } from "@/lib/settings";
import {
  CustomCodePanel,
  DownloadsSection,
  LocalEngineSection,
  PlayModePanel,
  PlayerEnginePanel,
  SeekBarPanel,
  SubtitleStylePanel,
} from "./player-panel";
import { Section, ToggleRow } from "./shared";

export function QualityPanel() {
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title="Play button behavior"
        subtitle="Choose what happens when you hit Play on a title. Manual gives you full control over quality and source."
      >
        <PlayModePanel />
      </Section>

      <Section
        title="Player engine"
        subtitle="HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source."
      >
        <PlayerEnginePanel />
      </Section>

      <Section
        title="Seek bar"
        subtitle="Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here."
      >
        <SeekBarPanel />
      </Section>

      <Section
        title="Subtitle style"
        subtitle="How subtitles look during playback. Live preview below."
      >
        <SubtitleStylePanel />
      </Section>

      <Section
        title="Stream format chips"
        subtitle="The little 4K · HDR · codec · audio chips that ride along each stream in the play picker."
      >
        <ToggleRow
          label="Show format chips on stream rows"
          sub="The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all."
          value={settings.showQualityBadge}
          onChange={(v) => update({ showQualityBadge: v })}
        />
        <QualityPreview />
      </Section>

      <Section
        title="Downloads"
        subtitle="Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive."
      >
        <DownloadsSection />
      </Section>

      <LocalEngineSection />

      <Section
        title="Custom code"
        subtitle="Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine."
      >
        <CustomCodePanel />
      </Section>
    </>
  );
}

function QualityPreview() {
  const samples: BadgeKind[] = [
    "8k",
    "4k-uhd",
    "uhd",
    "2k-qhd",
    "1080p",
    "1080i",
    "720p",
    "576p",
    "480p",
    "360p",
    "hd",
    "sd",
    "dvd",
    "imax",
    "3d",
    "bluray",
    "remux",
    "webdl",
    "webrip",
    "hdtv",
    "dvb",
    "cam",
    "hdcam",
    "telesync",
    "hdts",
    "telecine",
    "scr",
    "wp",
    "hevc",
    "av1",
    "dv",
    "hdr10-plus",
    "hdr10",
    "hdr",
    "hlg",
    "sdr",
    "atmos",
    "atmos-912",
    "truehd",
    "dts-hd-ma",
    "dts-hd",
    "dts-x",
    "dts",
    "ddp",
    "dd",
    "eac3",
    "ac3",
    "aac",
    "flac",
    "mp3",
    "opus",
    "lpcm",
    "pcm",
    "7.1",
    "5.1",
    "stereo",
    "mono",
    "extended",
    "remastered",
    "repack",
  ];
  return (
    <div className="flex flex-wrap items-center gap-0 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      {samples.map((k) => (
        <FormatBadge key={k} kind={k} />
      ))}
    </div>
  );
}
