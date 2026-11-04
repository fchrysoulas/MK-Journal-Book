/** Keep the original hover footprint while the visual paper lifts out of the way. */
export function bindNotePeek(paper, canPeek, {delay = 0, duration = 1200, pinned = false, onPin = () => {}} = {}) {
  const text = paper.querySelector(".mkjb-note-text"), sheet = paper.querySelector(".mkjb-note-sheet");
  let bounds = null, controls = [], keyboard = false, destroyed = false, timer;
  const pin = paper.querySelector("[data-mkjb-note-pin]");
  paper.style.setProperty("--mkjb-note-fold-duration", `${duration}ms`);
  const updatePin = () => {if (pin) {pin.setAttribute("aria-pressed", String(pinned)); pin.title = pinned ? "Unpin note to enable folding" : "Pin note open";}};
  updatePin();
  const inside = (rect, event) => rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  const reset = (instant = false) => {
    clearTimeout(timer); bounds = null; controls = []; keyboard = false;
    if (instant) {sheet.style.transition = "none";}
    paper.classList.remove("mkjb-note-peeking");
    if (instant) {void sheet.offsetHeight; sheet.style.removeProperty("transition");}
  };
  const reveal = fromKeyboard => {
    if (destroyed || pinned || !canPeek() || paper.classList.contains("mkjb-note-dragging")) return;
    bounds = paper.getBoundingClientRect();
    controls = Array.from(paper.querySelectorAll(".mkjb-note-controls,[data-mkjb-note-pin],[data-mkjb-note-resize]"), el => el.getBoundingClientRect());
    keyboard = fromKeyboard;
    paper.classList.add("mkjb-note-peeking");
  };
  const enter = event => {
    if (event.pointerType === "touch" || pinned) return;
    clearTimeout(timer); if (delay > 0) timer = setTimeout(() => reveal(false), delay); else reveal(false);
  };
  const leave = () => {clearTimeout(timer);};
  const togglePin = event => {event.preventDefault(); event.stopPropagation(); pinned = !pinned; reset(); updatePin(); onPin(pinned);};
  pin?.addEventListener("click", togglePin);
  const move = event => {
    if (!bounds || keyboard) return;
    if (!canPeek() || !inside(bounds, event) || controls.some(rect => inside(rect, event))) reset();
  };
  const key = event => {
    if (event.code === "Space") {event.preventDefault(); event.stopPropagation(); if (bounds) reset(); else reveal(true);}
    else if (event.key === "Escape" && bounds) {event.preventDefault(); event.stopPropagation(); reset();}
  };
  const blur = () => reset(), textBlur = () => {if (keyboard) reset();};
  text.addEventListener("pointerleave", leave); text.addEventListener("pointerenter", enter); text.addEventListener("keydown", key); text.addEventListener("blur", textBlur);
  document.addEventListener("pointermove", move, true);
  window.addEventListener("blur", blur);
  return {reset, destroy() {
    destroyed = true; reset(true);
    pin?.removeEventListener("click", togglePin); text.removeEventListener("pointerleave", leave); text.removeEventListener("pointerenter", enter); text.removeEventListener("keydown", key); text.removeEventListener("blur", textBlur);
    document.removeEventListener("pointermove", move, true); window.removeEventListener("blur", blur);
  }};
}
