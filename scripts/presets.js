import {escapeHTML as e} from "./core.js";

export const BOOK_PRESETS = {
  classic: {name: "Classic Parchment", image: "open-book.svg", cover: "classic-cover.svg", description: "Brown leather, warm parchment, Georgia serif text at 16 px."},
  gothic: {name: "Gothic Grimoire", image: "gothic-book.svg", cover: "gothic-cover.svg", description: "Oxblood leather, ornamented ivory pages, Palatino serif text at 17 px."},
  field: {name: "Field Journal", image: "field-book.svg", cover: "field-cover.svg", description: "Green cloth, lightly ruled paper, clean sans-serif text at 15 px."},
  arcane: {name: "Arcane Tome", image: "arcane-book.svg", cover: "arcane-cover.svg", description: "Indigo leather, silver celestial details, cool ivory paper, Baskerville serif text at 17 px."},
  nautical: {name: "Nautical Logbook", image: "nautical-book.svg", cover: "nautical-cover.svg", description: "Teal leather, brass compass details, weathered cream paper, compact Cambria serif text at 15 px."}
};
export function coverURL(preset) { return new URL(`../assets/${BOOK_PRESETS[resolveBookPreset(preset)].cover}`, import.meta.url).href; }
export function isBookPreset(value) { return typeof value === "string" && Object.hasOwn(BOOK_PRESETS, value); }
export function resolveBookPreset(value, fallback = "classic") {
  return isBookPreset(value) ? value : isBookPreset(fallback) ? fallback : "classic";
}
export function presetOptions(value, {inherit = false} = {}) {
  return (inherit ? `<option value="default" ${!isBookPreset(value) ? "selected" : ""}>Use module default</option>` : "") +
    Object.entries(BOOK_PRESETS).map(([key, preset]) => `<option value="${key}" ${key === value ? "selected" : ""}>${e(preset.name)}</option>`).join("");
}
