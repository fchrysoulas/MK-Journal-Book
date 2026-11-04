import {safeMediaURL} from "./core.js";
import {coverURL} from "./presets.js";
const text = (value, max) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
export function normalizeCover(value) {
  return {title: text(value?.title, 120), subtitle: text(value?.subtitle, 160), emblem: safeMediaURL(value?.emblem), image: safeMediaURL(value?.image)};
}
export function coverDetails(value, title, preset) {
  const cover = normalizeCover(value);
  return {...cover, title: cover.title || title || "Journal Book", image: cover.image || coverURL(preset)};
}
/** DOM attributes, not interpolated CSS, carry user-supplied artwork URLs. */
export function fillCover(element, value) {
  element.replaceChildren();
  const art = document.createElement("img"); art.className = "mkjb-cover-art"; art.src = value.image; art.alt = "";
  art.addEventListener("error", () => art.remove(), {once: true}); element.append(art);
  if (value.emblem) {
    const emblem = document.createElement("img"); emblem.className = "mkjb-cover-emblem"; emblem.src = value.emblem; emblem.alt = "";
    emblem.addEventListener("error", () => emblem.remove(), {once: true}); element.append(emblem);
  }
  const title = document.createElement("div"); title.className = "mkjb-cover-title"; title.textContent = value.title; element.append(title);
  if (value.subtitle) {const subtitle = document.createElement("div"); subtitle.className = "mkjb-cover-subtitle"; subtitle.textContent = value.subtitle; element.append(subtitle);}
}
