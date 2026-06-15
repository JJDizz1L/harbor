import { Github } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Section, ToggleRow } from "./shared";
import { LanguagesPicker } from "./streaming-panel";
import { DisplayLanguageSection } from "./language-panel/display-language-section";

const TMDB_LANGUAGES = [
  { value: "",      native: "English",              label: "Default" },
  { value: "ar-SA", native: "العربية",               label: "Arabic" },
  { value: "de-DE", native: "Deutsch",               label: "German" },
  { value: "es-ES", native: "Español (España)",       label: "Spanish (Spain)" },
  { value: "es-MX", native: "Español (Latinoamérica)",label: "Spanish (Latin America)" },
  { value: "fr-FR", native: "Français",               label: "French" },
  { value: "hi-IN", native: "हिन्दी",                 label: "Hindi" },
  { value: "it-IT", native: "Italiano",               label: "Italian" },
  { value: "ja-JP", native: "日本語",                  label: "Japanese" },
  { value: "ko-KR", native: "한국어",                  label: "Korean" },
  { value: "nl-NL", native: "Nederlands",             label: "Dutch" },
  { value: "pl-PL", native: "Polski",                 label: "Polish" },
  { value: "pt-BR", native: "Português (Brasil)",     label: "Portuguese (Brazil)" },
  { value: "pt-PT", native: "Português (Portugal)",   label: "Portuguese (Portugal)" },
  { value: "ru-RU", native: "Русский",                label: "Russian" },
  { value: "tr-TR", native: "Türkçe",                 label: "Turkish" },
  { value: "uk-UA", native: "Українська",             label: "Ukrainian" },
  { value: "zh-CN", native: "中文 (简体)",              label: "Chinese (Simplified)" },
];

function TmdbLanguageDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = TMDB_LANGUAGES.find((l) => l.value === value) ?? TMDB_LANGUAGES[0];

  return (
    <div className="relative w-full max-w-[340px]">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 text-[13.5px] transition-all ${
          open
            ? "border-edge bg-elevated shadow-sm"
            : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-medium text-ink truncate">{current.native}</span>
          <span className="text-[12px] text-ink-muted shrink-0">{current.label}</span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-xl">
            <div className="max-h-64 overflow-y-auto py-1.5">
              {TMDB_LANGUAGES.map((lang) => {
                const selected = lang.value === value;
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => {
                      onChange(lang.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors ${
                      selected
                        ? "bg-ink/8 text-ink"
                        : "text-ink hover:bg-ink/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[13.5px] font-medium truncate">{lang.native}</span>
                      <span className="text-[12px] text-ink-muted shrink-0">{lang.label}</span>
                    </div>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function LanguagePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [blockDraft, setBlockDraft] = useState(settings.trackBlockWords.join(", "));
  return (
    <>
    <DisplayLanguageSection />
    <Section
      title={t("Subtitle languages")}
      subtitle={t("When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.")}
    >
      <LanguagesPicker
        value={settings.preferredSubLangs}
        onChange={(langs) => update({ preferredSubLangs: langs })}
      />
      <ToggleRow
        label={t("Start with subtitles off")}
        sub={t("Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.")}
        value={settings.subtitlesOffByDefault}
        onChange={(v) => update({ subtitlesOffByDefault: v })}
      />
      <ToggleRow
        label={t("Prefer embedded subtitles")}
        sub={t("When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.")}
        value={settings.preferEmbeddedSubs}
        onChange={(v) => update({ preferEmbeddedSubs: v })}
      />
      <ToggleRow
        label={t("Forced subs with native audio")}
        sub={t("When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.")}
        value={settings.forcedSubsWhenNativeAudio}
        onChange={(v) => update({ forcedSubsWhenNativeAudio: v })}
      />
      <div className="flex flex-col gap-1.5 pt-1">
        <p className="text-[13.5px] font-medium text-ink">{t("Never auto-select tracks containing")}</p>
        <p className="text-[12px] leading-relaxed text-ink-subtle">
          {t("Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.")}
        </p>
        <input
          type="text"
          value={blockDraft}
          onChange={(e) => {
            setBlockDraft(e.target.value);
            update({
              trackBlockWords: e.target.value
                .split(",")
                .map((w) => w.trim())
                .filter(Boolean),
            });
          }}
          placeholder={t("commentary, descriptive")}
          className="h-11 w-full max-w-[340px] rounded-xl border border-edge-soft bg-canvas/40 px-3.5 text-[13.5px] text-ink outline-none transition-colors focus:border-edge"
        />
      </div>
    </Section>

    <Section
      title={t("Metadata language")}
      subtitle={t("Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.")}
    >
      <TmdbLanguageDropdown
        value={settings.tmdbLanguage}
        onChange={(v) => update({ tmdbLanguage: v })}
      />
      {settings.tmdbLanguage && (
        <div className="mt-4 border-t border-edge-soft pt-4 flex flex-col gap-1">
          <ToggleRow
            label={t("Translate titles")}
            sub={t("If disabled, titles remain in their original language.")}
            value={settings.translateTitles}
            onChange={(v) => update({ translateTitles: v })}
          />
          <ToggleRow
            label={t("Translate descriptions")}
            sub={t("If disabled, overviews and taglines remain in their original language. (Applies only inside the details page)")}
            value={settings.translateDescriptions}
            onChange={(v) => update({ translateDescriptions: v })}
          />
          <ToggleRow
            label={t("Translate posters")}
            sub={t("If disabled, posters remain in their original language. (Applies only inside the details page)")}
            value={settings.translatePosters}
            onChange={(v) => update({ translatePosters: v })}
            lockReason={settings.posterBaseUrl ? t("Poster translation is disabled because a custom poster service is active.") : undefined}
          />
        </div>
      )}
    </Section>

    <Section
      title={t("Audio languages")}
      subtitle={t("When a release ships multiple audio tracks, Harbor selects the first match from this list.")}
    >
      <LanguagesPicker
        value={settings.preferredAudioLangs}
        onChange={(langs) => update({ preferredAudioLangs: langs })}
      />
    </Section>

    <Section
      title={t("Preferred languages")}
      subtitle={t("Streams in these languages rank first. Toggle below to drop everything else.")}
    >
      <LanguagesPicker
        value={settings.preferredLanguages}
        onChange={(langs) => update({ preferredLanguages: langs })}
      />
      <ToggleRow
        label={t("Only show streams in my languages")}
        sub={t("Hides streams with no detected preferred language. Multi-audio releases count as a match.")}
        value={settings.requirePreferredLanguage}
        onChange={(v) => update({ requirePreferredLanguage: v })}
      />
      <div className="mt-2 flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-ink-muted sm:max-w-[480px]">
          {t("Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.")}
        </p>
        <button
          onClick={() => openUrl("https://github.com/harborstremio/harbor")}
          className="flex shrink-0 items-center gap-2 self-start rounded-full border border-edge-soft px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-edge sm:self-auto"
        >
          <Github size={13} strokeWidth={2.2} />
          {t("Contribute on GitHub")}
        </button>
      </div>
    </Section>
    </>
  );
}
