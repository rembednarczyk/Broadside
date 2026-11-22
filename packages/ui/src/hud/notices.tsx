import { useHud } from "../store/hud-store";
import { isTextKey, text } from "../i18n/catalog";

/** A notice key, or a key with numbers after "|" filling its {0}, {1}… (e.g. "notice.hits|7|14"). */
const noticeText = (lang: "en" | "pl", raw: string): string => {
  const [key, ...args] = raw.split("|");
  if (!key || !isTextKey(key)) return raw;
  return text(lang, key).replace(/\{(\d)\}/g, (_m, i: string) => args[Number(i)] ?? "");
};

export const Notices = () => {
  const notices = useHud((h) => h.notices);
  const lang = useHud((h) => h.language);
  return (
    <div className="notices">
      {notices.map((n) => (
        <div key={n.id} className="notice">{noticeText(lang, n.key)}</div>
      ))}
    </div>
  );
};
