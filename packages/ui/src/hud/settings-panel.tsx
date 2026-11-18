import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";
import { type SettingsIntents } from "../intents";

const PRESETS = ["low", "medium", "high", "ultra", "cinematic"] as const;

/** Graphics quality presets, render resolution and language. */
export const SettingsPanel = ({ intents }: { intents: SettingsIntents }) => {
  const open = useHud((h) => h.settingsOpen);
  const g = useHud((h) => h.graphics);
  const lang = useHud((h) => h.language);
  const steering = useHud((h) => h.steering);
  const reef = useHud((h) => h.reef);
  if (!open) return null;
  const custom = `gfx.${g.preset}`;
  return (
    <div className="panel settings" data-testid="settings">
      <div className="title">{text(lang, "settings.title")}</div>
      <div className="label">{text(lang, "settings.graphics")} · {isTextKey(custom) ? text(lang, custom) : g.preset}</div>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p} className={g.preset === p ? "on" : ""} onPointerDown={() => intents.setGraphicsPreset(p)} data-testid={`gfx-${p}`}>
            {text(lang, `gfx.${p}`)}
          </button>
        ))}
      </div>
      <div className="label">{text(lang, "settings.color")}</div>
      <div className="presets three">
        {(["sepia", "natural", "vibrant"] as const).map((c) => (
          <button key={c} className={g.colorMode === c ? "on" : ""} onPointerDown={() => intents.setColorMode(c)} data-testid={`color-${c}`}>
            {text(lang, `color.${c}`)}
          </button>
        ))}
      </div>
      <div className="label">{text(lang, "settings.resolution")} {Math.round(g.renderScale * 100)}%</div>
      <input type="range" min={50} max={100} step={5} value={Math.round(g.renderScale * 100)} onChange={(e) => intents.setRenderScale(Number(e.target.value) / 100)} />
      <button className="wide" onPointerDown={() => intents.toggleHelp()} data-testid="open-help">{text(lang, "help.open")}</button>
      <button className="wide" onPointerDown={() => intents.newGame()} data-testid="new-game">{text(lang, "settings.newGame")}</button>
      <div className="label">{text(lang, "settings.steering")}</div>
      <div className="presets">
        {(["simple", "classic"] as const).map((m) => (
          <button key={m} className={steering === m ? "on" : ""} onPointerDown={() => intents.setSteering(m)} data-testid={`steering-${m}`}>
            {text(lang, `steering.${m}`)}
          </button>
        ))}
      </div>
      <div className="label">{text(lang, "settings.reef")}</div>
      <div className="presets">
        {([true, false] as const).map((on) => (
          <button key={String(on)} className={reef === on ? "on" : ""} onPointerDown={() => intents.setReef(on)} data-testid={`reef-${on ? "on" : "off"}`}>
            {text(lang, on ? "settings.on" : "settings.off")}
          </button>
        ))}
      </div>
      <div className="label">{text(lang, "settings.language")}</div>
      <div className="presets">
        <button className={lang === "en" ? "on" : ""} onPointerDown={() => intents.setLanguage("en")}>English</button>
        <button className={lang === "pl" ? "on" : ""} onPointerDown={() => intents.setLanguage("pl")}>Polski</button>
      </div>
    </div>
  );
};
