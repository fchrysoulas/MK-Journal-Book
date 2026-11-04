import {fillCover} from "./cover.js";
/** Visual-only snapshots: no live controls, duplicate IDs, or focus targets. */
export function snapshotLeaf(leaf) {
  if (!leaf) return null;
  const clone = leaf.cloneNode(true);
  clone.inert = true;
  clone.setAttribute("aria-hidden", "true");
  for (const element of [clone, ...clone.querySelectorAll("*")]) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name === "id" || attr.name === "tabindex" || attr.name.startsWith("data-")) element.removeAttribute(attr.name);
    }
  }
  // Avoid starting a second media player while turning a page.
  clone.querySelectorAll("iframe,video,audio").forEach(media => media.replaceWith(document.createElement("div")));
  for (const [index, source] of Array.from(leaf.querySelectorAll(".mkjb-content,.mkjb-journal-index,.mkjb-note-text")).entries()) {
    const target = clone.querySelectorAll(".mkjb-content,.mkjb-journal-index,.mkjb-note-text")[index];
    if (target) target.dataset.turnScroll = String(source.scrollTop);
  }
  return clone;
}

/** Hold the outgoing spread through Foundry's asynchronous render/post-render work. */
export function holdSpread(before) {
  const layer = document.createElement("div"); layer.className = "mkjb-turn-preparation";
  layer.inert = true; layer.setAttribute("aria-hidden", "true"); layer.append(before.left, before.right);
  let mounted = null;
  return {
    mount(container) {
      if (!container) return;
      mounted?.classList.remove("mkjb-preparing-turn"); mounted = container;
      container.classList.add("mkjb-preparing-turn"); container.append(layer);
      for (const scroll of layer.querySelectorAll("[data-turn-scroll]")) scroll.scrollTop = Number(scroll.dataset.turnScroll);
    },
    remove() {layer.remove(); mounted?.classList.remove("mkjb-preparing-turn"); mounted = null;}
  };
}

export function animateSpread(container, before, direction, duration = 520) {
  const forward = direction === "next";
  const overlay = document.createElement("div");
  overlay.className = `mkjb-turn-layer ${forward ? "mkjb-turn-forward" : "mkjb-turn-backward"}`;
  overlay.inert = true; overlay.setAttribute("aria-hidden", "true");
  const stationary = forward ? before.left : before.right;
  const front = forward ? before.right : before.left;
  const back = snapshotLeaf(container.querySelector(forward ? ":scope > .mkjb-left" : ":scope > .mkjb-right"));
  const holder = document.createElement("div");
  holder.className = "mkjb-turn-stationary";
  holder.append(stationary);
  front.classList.add("mkjb-turn-face", "mkjb-turn-front");
  back.classList.add("mkjb-turn-face", "mkjb-turn-back");
  const sheet = document.createElement("div"); sheet.className = "mkjb-turn-sheet";
  sheet.append(front, back); overlay.append(holder, sheet); container.append(overlay);
  for (const scroll of overlay.querySelectorAll("[data-turn-scroll]")) scroll.scrollTop = Number(scroll.dataset.turnScroll);
  const angle = forward ? -180 : 180;
  let animation;
  try {animation = sheet.animate([
    {transform: "rotateY(0deg)"},
    {transform: `rotateY(${angle * .48}deg)`, offset: .5},
    {transform: `rotateY(${angle}deg)`}
  ], {duration, easing: "cubic-bezier(.35,.05,.2,1)", fill: "both"});}
  catch (error) {overlay.remove(); throw error;}
  const finished = animation.finished.catch(() => {}).finally(() => overlay.remove());
  return {finished, cancel() {animation.cancel(); overlay.remove();}};
}

/** Fold the front half over the right page, hold on the cover, then fade it away. */
export function animateBookClose(container, {title, cover, duration = 520} = {}) {
  return animateBookCover(container, {title, cover, duration, opening: false});
}

/** Reverse the closing sequence: fade in the cover, hold, then unfold the book. */
export function animateBookOpen(container, {title, cover, duration = 520} = {}) {
  return animateBookCover(container, {title, cover, duration, opening: true});
}

function animateBookCover(container, {title, cover: coverData, duration, opening}) {
  const inside = snapshotLeaf(container.querySelector(":scope > .mkjb-left"));
  const right = snapshotLeaf(container.querySelector(":scope > .mkjb-right"));
  if (!inside || !right) return null;
  const overlay = document.createElement("div");
  overlay.className = `mkjb-close-layer${opening ? " mkjb-open-layer" : ""}`; overlay.inert = true; overlay.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div"); stage.className = "mkjb-close-stage";
  const rest = document.createElement("div"); rest.className = "mkjb-close-rest";
  const sheet = document.createElement("div"); sheet.className = "mkjb-close-sheet";
  inside.classList.add("mkjb-close-inside");
  right.classList.add("mkjb-close-stationary");
  const cover = document.createElement("div"); cover.className = "mkjb-close-cover";
  const name = document.createElement("div"); name.className = "mkjb-cover-title"; name.textContent = title ?? "Journal Book";
  if (coverData) fillCover(cover, coverData); else cover.append(name); sheet.append(inside, cover); rest.append(right); stage.append(rest, sheet); overlay.append(stage);
  container.append(overlay); container.closest(".mkjb-shell").classList.add(opening ? "mkjb-is-opening" : "mkjb-is-closing");
  for (const scroll of overlay.querySelectorAll("[data-turn-scroll]")) scroll.scrollTop = Number(scroll.dataset.turnScroll);
  const hold = 220, fade = 180, total = duration + hold + fade;
  const animations = [];
  try {
    animations.push(sheet.animate(opening ? [{transform: "rotateY(180deg)"}, {transform: "rotateY(0deg)"}] : [{transform: "rotateY(0deg)"}, {transform: "rotateY(180deg)"}],
      {duration, delay: opening ? fade + hold : 0, easing: "cubic-bezier(.35,.05,.2,1)", fill: "both"}));
    animations.push(stage.animate(opening ? [{transform: "translateX(-25%)"}, {transform: "translateX(0)"}] : [{transform: "translateX(0)"}, {transform: "translateX(-25%)"}],
      {duration, delay: opening ? fade + hold : 0, easing: "cubic-bezier(.35,.05,.2,1)", fill: "both"}));
    animations.push(overlay.animate(opening ? [{opacity: 0}, {opacity: 1, offset: fade / total}, {opacity: 1}] : [{opacity: 1}, {opacity: 1, offset: (duration + hold) / total}, {opacity: 0}],
      {duration: total, easing: "linear", fill: "forwards"}));
  } catch (error) {
    animations.forEach(animation => animation.cancel()); overlay.remove(); throw error;
  }
  return {
    finished: Promise.all(animations.map(animation => animation.finished.catch(() => {}))),
    cancel() {animations.forEach(animation => animation.cancel()); overlay.remove();}
  };
}
