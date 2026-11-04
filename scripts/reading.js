import {ID, INDEX_UUID, bookSequence, escapeHTML as e} from "./core.js";

export function readingPosition(user, key, pages, alwaysIndex = false) {
  const saved = user.getFlag(ID, "reading")?.[key];
  if (alwaysIndex || !saved || typeof saved.tab !== "string") return {tab: "all", uuid: INDEX_UUID};
  return bookSequence(pages, saved.tab).some(row => row.uuid === saved.uuid)
    ? {tab: saved.tab, uuid: saved.uuid} : {tab: "all", uuid: INDEX_UUID};
}
export function searchExcerpt(text, query) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  const at = clean.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, at - 48), end = Math.min(clean.length, Math.max(0, at) + 120);
  return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}
/** Input is already enriched and permission-filtered by renderPage. Never search raw secret HTML. */
export function searchableText(html) {
  const template = document.createElement("template"); template.innerHTML = html;
  template.content.querySelectorAll("script,style,iframe,video,audio").forEach(el => el.remove());
  template.content.querySelectorAll("p,div,li,br,h1,h2,h3,h4,section,td").forEach(el => el.append(" "));
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}
export function searchResultsHTML(rows) {
  return rows.map(row => `<li><button type="button" data-mkjb-search-result="${e(row.uuid)}"><strong>${e(row.name)}</strong><small>${e(row.journal)}</small><span>${e(row.excerpt)}</span></button></li>`).join("");
}

/** Foundry may expand flags and attach document statistics before emitting the hook. */
export function isReadingPositionUpdate(changes) {
  if (!changes || typeof changes !== "object") return false;
  const keys = Object.keys(changes).filter(key => !["_id", "_stats"].includes(key) && !key.startsWith("_stats."));
  return keys.length > 0 && keys.every(key => key === `flags.${ID}.reading` || key.startsWith(`flags.${ID}.reading.`)
    || (key === "flags" && Object.keys(changes.flags ?? {}).length > 0
      && Object.keys(changes.flags).every(scope => scope === ID && Object.keys(changes.flags[ID] ?? {}).length > 0
        && Object.keys(changes.flags[ID]).every(flag => flag === "reading"))));
}
