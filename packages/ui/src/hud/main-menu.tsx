import { useHud, type OptionsTab, type SoundVolumes } from "../store/hud-store";
import { isTextKey, text, type TextKey } from "../i18n/catalog";
import { type SettingsIntents } from "../intents";

const PRESETS = ["low", "medium", "high", "ultra", "cinematic"] as const;
const TABS: readonly OptionsTab[] = ["graphics", "sound", "gameplay"];

/**
 * The main menu (on start and behind the ⚙ button; the game is paused while it is open) and its
 * options screen in three tabs: graphics, sound and gameplay; the sea chart opens from it (sea-chart). A modal screen over the paused sea,
 * the HUD hidden (the menu's state machine: main ⇄ options, either back to the game).
 */
export const MainMenu = ({ intents }: { intents: SettingsIntents }) => {
  const menu = useHud((h) => h.menu);
  const lang = useHud((h) => h.language);
  if (!menu) return null;
  if (menu === "options") return <Options intents={intents} />;
  const t = (k: TextKey) => text(lang, k);
  return (
    <div className="menu-screen" data-testid="main-menu">
      <div className="panel menu">
        <div className="menu-title">Broadside</div>
        <div className="menu-sub">{t("menu.subtitle")}</div>
        <button className="wide big" onPointerDown={() => intents.showMenu(null)} data-testid="close-settings">{t("menu.resume")}</button>
        <button className="wide" onPointerDown={() => intents.newGame()} data-testid="new-game">{t("settings.newGame")}</button>
        <button className="wide" onPointerDown={() => intents.showMenu("chart")} data-testid="menu-chart">{t("menu.chart")}</button>
        <button className="wide" onPointerDown={() => intents.showMenu("options")} data-testid="open-options">{t("menu.options")}</button>
        <button className="wide" onPointerDown={() => intents.toggleHelp()} data-testid="open-help">{t("help.open")}</button>
      </div>
    </div>
  );
};

const Options = ({ intents }: { intents: SettingsIntents }) => {
  const lang = useHud((h) => h.language);
  const tab = useHud((h) => h.optionsTab);
  const t = (k: TextKey) => text(lang, k);
  return (
    <div className="menu-screen" data-testid="options">
      <div className="panel settings">
        <div className="title">{t("menu.options")}</div>
        <div className="tabs">
          {TABS.map((k) => (
            <button key={k} className={tab === k ? "on" : ""} onPointerDown={() => intents.setOptionsTab(k)} data-testid={`tab-${k}`}>
              {t(`options.${k}` as TextKey)}
            </button>
          ))}
        </div>
        {tab === "graphics" && <Graphics intents={intents} />}
        {tab === "sound" && <Sound intents={intents} />}
        {tab === "gameplay" && <Gameplay intents={intents} />}
        <button className="wide" onPointerDown={() => intents.showMenu("main")} data-testid="options-back">{t("menu.back")}</button>
      </div>
    </div>
  );
};

const Graphics = ({ intents }: { intents: SettingsIntents }) => {
  const g = useHud((h) => h.graphics);
  const fpsCap = useHud((h) => h.fpsCap);
  const lang = useHud((h) => h.language);
  const custom = `gfx.${g.preset}`;
  return (
    <>
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
      <div className="label">{text(lang, "settings.fpsCap")}</div>
      <div className="presets two">
        {[30, 0].map((c) => (
          <button key={c} className={fpsCap === c ? "on" : ""} onPointerDown={() => intents.setFpsCap(c)} data-testid={`fps-${c}`}>
            {text(lang, c ? "fps.30" : "fps.free")}
          </button>
        ))}
      </div>
    </>
  );
};

const Sound = ({ intents }: { intents: SettingsIntents }) => {
  const v = useHud((h) => h.sound);
  const lang = useHud((h) => h.language);
  return (
    <>
      {(["master", "ambience", "effects"] as const satisfies readonly (keyof SoundVolumes)[]).map((k) => (
        <div key={k}>
          <div className="label">{text(lang, `sound.${k}` as TextKey)} {Math.round(v[k] * 100)}%</div>
          <input type="range" min={0} max={100} step={5} value={Math.round(v[k] * 100)} onChange={(e) => intents.setVolume(k, Number(e.target.value) / 100)} data-testid={`volume-${k}`} />
        </div>
      ))}
    </>
  );
};

const Gameplay = ({ intents }: { intents: SettingsIntents }) => {
  const lang = useHud((h) => h.language);
  const steering = useHud((h) => h.steering);
  const reef = useHud((h) => h.reef);
  const haptics = useHud((h) => h.haptics);
  const shake = useHud((h) => h.shake);
  const onOff = (on: boolean, set: (on: boolean) => void, id: string) =>
    ([true, false] as const).map((v) => (
      <button key={String(v)} className={on === v ? "on" : ""} onPointerDown={() => set(v)} data-testid={`${id}-${v ? "on" : "off"}`}>
        {text(lang, v ? "settings.on" : "settings.off")}
      </button>
    ));
  return (
    <>
      <div className="label">{text(lang, "settings.steering")}</div>
      <div className="presets four">
        {(["simple", "classic", "arcade", "fun"] as const).map((m) => (
          <button key={m} className={steering === m ? "on" : ""} onPointerDown={() => intents.setSteering(m)} data-testid={`steering-${m}`}>
            {text(lang, `steering.${m}`)}
          </button>
        ))}
      </div>
      <div className="label">{text(lang, "settings.reef")}</div>
      <div className="presets two">{onOff(reef, (on) => intents.setReef(on), "reef")}</div>
      <div className="label">{text(lang, "settings.haptics")}</div>
      <div className="presets two">{onOff(haptics, (on) => intents.setHaptics(on), "haptics")}</div>
      <div className="label">{text(lang, "settings.shake")}</div>
      <div className="presets two">{onOff(shake, (on) => intents.setShake(on), "shake")}</div>
      <div className="label">{text(lang, "settings.language")}</div>
      <div className="presets two">
        <button className={lang === "en" ? "on" : ""} onPointerDown={() => intents.setLanguage("en")}>English</button>
        <button className={lang === "pl" ? "on" : ""} onPointerDown={() => intents.setLanguage("pl")}>Polski</button>
      </div>
    </>
  );
};
