import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

export const Notices = () => {
  const notices = useHud((h) => h.notices);
  const lang = useHud((h) => h.language);
  return (
    <div className="notices">
      {notices.map((n) => (
        <div key={n.id} className="notice">{isTextKey(n.key) ? text(lang, n.key) : n.key}</div>
      ))}
    </div>
  );
};
