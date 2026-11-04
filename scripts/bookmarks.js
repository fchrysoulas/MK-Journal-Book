import {ID, INDEX_UUID} from "./core.js";

export const RIBBON_COLORS = ["#a34b49", "#4f755b", "#4e6f9a", "#8a6093", "#b0853e", "#4d8a89"];
export function ribbonColor(value, fallback = RIBBON_COLORS[0]) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}
export function normalizeBookmarks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(item => {
    if (!item || typeof item.uuid !== "string" || seen.has(item.uuid)) return [];
    seen.add(item.uuid);
    return [{uuid: item.uuid, label: typeof item.label === "string" ? item.label.trim().slice(0, 60) : "", color: ribbonColor(item.color)}];
  });
}
export function savedBookmarks(user, key) {
  return normalizeBookmarks(user.getFlag(ID, "bookmarks")?.[key]);
}
/** Never expose a bookmark's old title when its target is no longer readable/included. */
export function visibleBookmarks(saved, pages) {
  const targets = new Map([[INDEX_UUID, {name: "Journal Index", number: 1}], ...pages.map((row, index) => [row.uuid, {name: row.name, number: index + 2}])]);
  return normalizeBookmarks(saved).flatMap(mark => {
    const target = targets.get(mark.uuid);
    return target ? [{...mark, label: mark.label || target.name, pageNumber: target.number}] : [];
  });
}
export function updatedBookmarks(saved, mark, remove = false) {
  const current = normalizeBookmarks(saved);
  if (remove) return current.filter(item => item.uuid !== mark.uuid);
  const normalized = normalizeBookmarks([mark])[0];
  if (!normalized) throw new Error("Choose a valid bookmark page.");
  const index = current.findIndex(item => item.uuid === normalized.uuid);
  if (index < 0) current.push(normalized);
  else current[index] = normalized;
  return current;
}
