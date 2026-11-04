import {safeMediaURL} from "./core.js";

/** A local modal preserves the book and scroll position beneath it. */
export function viewBookImage(image, {valid = () => true} = {}) {
  const src = safeMediaURL(image.currentSrc || image.getAttribute("src"));
  if (!src || !valid()) return null;
  const originalFocus = document.activeElement;
  const dialog = document.createElement("dialog"); dialog.className = "mkjb-image-viewer"; dialog.setAttribute("aria-label", image.alt || "Book illustration");
  const bar = document.createElement("div"); bar.className = "mkjb-image-toolbar";
  const caption = document.createElement("span"); caption.textContent = image.alt || "Illustration";
  const scroller = document.createElement("div"); scroller.className = "mkjb-image-scroll";
  const picture = document.createElement("img"); picture.src = src; picture.alt = image.alt; picture.draggable = false;
  let zoom = 1, closed = false;
  const render = () => {
    if (!picture.naturalWidth) return;
    const fit = Math.min(1, (scroller.clientWidth - 24) / picture.naturalWidth, (scroller.clientHeight - 24) / picture.naturalHeight);
    picture.style.width = `${Math.max(1, picture.naturalWidth * fit * zoom)}px`;
    picture.style.height = `${Math.max(1, picture.naturalHeight * fit * zoom)}px`;
  };
  const close = () => {if (closed) return; closed = true; observer.disconnect(); dialog.close(); dialog.remove(); if (originalFocus?.isConnected) originalFocus.focus({preventScroll: true});};
  const button = (label, glyph, action) => {const button = document.createElement("button"); button.type = "button"; button.textContent = glyph; button.title = label; button.setAttribute("aria-label", label); button.onclick = action; bar.append(button);};
  bar.append(caption);
  button("Zoom out", "−", () => {zoom = Math.max(1, zoom / 1.5); render();});
  button("Fit image", "Fit", () => {zoom = 1; render(); scroller.scrollTo(0, 0);});
  button("Zoom in", "+", () => {zoom = Math.min(8, zoom * 1.5); render();});
  button("Close image", "×", close);
  const observer = new ResizeObserver(() => {if (!valid()) close(); else render();});
  picture.onload = render; picture.onerror = () => {caption.textContent = "This image could not be loaded.";};
  scroller.append(picture); dialog.append(bar, scroller); document.body.append(dialog); dialog.showModal(); observer.observe(scroller);
  dialog.addEventListener("keydown", event => {if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); close();}}, true);
  dialog.addEventListener("cancel", event => {event.preventDefault(); event.stopPropagation(); close();});
  dialog.addEventListener("click", event => {if (event.target === dialog) close();});
  // Drag to pan enlarged maps; native scrollbars and keyboard scrolling also remain available.
  let drag;
  scroller.addEventListener("pointerdown", event => {if (event.button !== 0) return; drag = {x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop}; scroller.setPointerCapture(event.pointerId);});
  scroller.addEventListener("pointermove", event => {if (drag) {scroller.scrollLeft = drag.left - event.clientX + drag.x; scroller.scrollTop = drag.top - event.clientY + drag.y;}});
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) scroller.addEventListener(type, () => {drag = null;});
  scroller.tabIndex = 0;
  return {close};
}
