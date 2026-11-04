import {notePlacement, noteRotation, notePosition} from "./notes.js";
import {bindNotePeek} from "./note-peek.js";

/** Positioning is presentation only until pointer-up; cancellation never writes flags. */
export function bindNoteLayout(root, {read, canEdit, canPeek, save, error, peekOptions = () => ({})}) {
  let active = null, destroyed = false;
  const states = new Map();
  const clamp = value => Math.max(0, Math.min(1, value));
  const metrics = state => {
    const stage = state.space === "page" ? state.area : state.body;
    const box = notePlacement(stage.clientWidth, stage.clientHeight, state.paper.offsetWidth, state.paper.offsetHeight, noteRotation(state.note), state.position ?? {x: 1, y: 0});
    // Both regions share the page as their offset parent. Use layout coordinates;
    // viewport rectangles include any transient scale on the Foundry window.
    return {...box, left: box.left + stage.offsetLeft - state.area.offsetLeft, top: box.top + stage.offsetTop - state.area.offsetTop};
  };
  const place = state => {
    if (!state.area.clientWidth || !state.area.clientHeight) return;
    if (state.note.size) {
      state.paper.style.width = `${state.note.size.width}px`;
      state.paper.style.height = `${state.note.size.height}px`;
      state.paper.classList.add("mkjb-note-sized");
    }
    const box = metrics(state);
    Object.assign(state.paper.style, {left: `${box.left}px`, top: `${box.top}px`, transform: `rotate(${noteRotation(state.note)}deg) scale(${box.scale})`});
  };
  const layout = () => {if (!destroyed) for (const state of states.values()) {state.peek?.reset(true); place(state);}};
  const observer = new ResizeObserver(layout);
  const commit = (state, note) => {
    if (!canEdit()) return;
    Promise.resolve(save(state.uuid, note, state.position, state.id, state.note.size, state.space)).catch(error);
  };
  for (const paper of root.querySelectorAll(".mkjb-page-note")) {
    const leaf = paper.closest("[data-mkjb-leaf]"), uuid = leaf?.dataset.mkjbLeaf, id = paper.dataset.noteId ?? "primary", note = read(uuid, id);
    const body = leaf?.querySelector(".mkjb-page-body"), area = paper.closest(".mkjb-note-area");
    if (!note || !body || !area) continue;
    const state = {paper, uuid, id, note, body, area, position: notePosition(note), space: note.position ? note.positionSpace : "content"};
    state.peek = bindNotePeek(paper, () => !destroyed && !active && canPeek(), peekOptions(uuid, id));
    states.set(paper, state); observer.observe(body); observer.observe(area); observer.observe(paper); place(state);
    const resize = paper.querySelector("[data-mkjb-note-resize]");
    const sizeTo = (width, height) => {
      state.note = {...state.note, size: {width: Math.round(Math.max(140, Math.min(420, width))), height: Math.round(Math.max(80, Math.min(420, height)))}};
      place(state);
    };
    resize?.addEventListener("pointerdown", event => {
      if (destroyed || event.button !== 0 || active || !canEdit()) return;
      const current = read(uuid, id); if (!current) return;
      event.preventDefault(); event.stopPropagation(); state.peek.reset(true);
      const before = {note: state.note, style: paper.getAttribute("style"), classes: paper.className};
      const width = paper.offsetWidth, height = paper.offsetHeight, x = event.clientX, y = event.clientY;
      const angle = noteRotation(current) * Math.PI / 180, scale = metrics(state).scale;
      let moved = false;
      resize.setPointerCapture(event.pointerId); paper.classList.add("mkjb-note-dragging");
      const move = ev => {
        if (ev.pointerId !== event.pointerId) return;
        if (!canEdit()) {stop(false); return;}
        const dx = (ev.clientX - x) / scale, dy = (ev.clientY - y) / scale;
        moved ||= Math.hypot(dx, dy) > 3;
        sizeTo(width + dx * Math.cos(angle) + dy * Math.sin(angle), height + dy * Math.cos(angle) - dx * Math.sin(angle));
      };
      const release = ev => {if (ev.pointerId === event.pointerId) stop(ev.type === "pointerup");};
      const key = ev => {if (ev.key === "Escape") {ev.preventDefault(); ev.stopPropagation(); stop(false);}};
      const cancel = () => stop(false);
      const stop = persist => {
        resize.removeEventListener("pointermove", move); resize.removeEventListener("pointerup", release);
        resize.removeEventListener("pointercancel", release); resize.removeEventListener("lostpointercapture", release);
        document.removeEventListener("keydown", key, true); window.removeEventListener("blur", cancel);
        active = null;
        if (resize.hasPointerCapture(event.pointerId)) resize.releasePointerCapture(event.pointerId);
        paper.classList.remove("mkjb-note-dragging");
        if (persist && moved && canEdit()) commit(state, current);
        else {state.note = before.note; paper.setAttribute("style", before.style ?? ""); paper.className = before.classes;}
      };
      active = cancel;
      resize.addEventListener("pointermove", move); resize.addEventListener("pointerup", release);
      resize.addEventListener("pointercancel", release); resize.addEventListener("lostpointercapture", release);
      document.addEventListener("keydown", key, true); window.addEventListener("blur", cancel);
    });
    resize?.addEventListener("keydown", event => {
      const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
      if (!direction || destroyed || active || !canEdit()) return;
      const current = read(uuid, id); if (!current) return;
      event.preventDefault(); event.stopPropagation(); state.peek.reset(true);
      const step = event.shiftKey ? 1 : 10;
      sizeTo(paper.offsetWidth + direction[0] * step, paper.offsetHeight + direction[1] * step); commit(state, current);
    });
    const handle = paper.querySelector("[data-mkjb-note-move]");
    if (!handle) continue;
    const float = () => {
      paper.classList.add("mkjb-note-positioned");
      state.space = "page";
    };
    handle.addEventListener("pointerdown", event => {
      if (destroyed || event.button !== 0 || active || !canEdit()) return;
      const current = read(uuid, id);
      if (!current) return;
      event.preventDefault(); event.stopPropagation();
      state.peek.reset(true);
      const before = {style: paper.getAttribute("style"), classes: paper.className, position: state.position, space: state.space};
      const rect = paper.getBoundingClientRect(), origin = {x: event.clientX, y: event.clientY};
      let moved = false;
      state.note = current;
      float();
      const moveTo = (x, y) => {
        const bounds = area.getBoundingClientRect(), box = metrics(state);
        state.position = {x: box.rangeX ? clamp((rect.left + rect.width / 2 + x - bounds.left - paper.offsetWidth / 2 - box.minX) / box.rangeX) : .5,
          y: box.rangeY ? clamp((rect.top + rect.height / 2 + y - bounds.top - paper.offsetHeight / 2 - box.minY) / box.rangeY) : .5};
        place(state);
      };
      moveTo(0, 0);
      handle.setPointerCapture(event.pointerId);
      paper.classList.add("mkjb-note-dragging");
      const move = ev => {
        if (ev.pointerId !== event.pointerId) return;
        if (!canEdit()) {stop(false); return;}
        const dx = ev.clientX - origin.x, dy = ev.clientY - origin.y;
        if (Math.hypot(dx, dy) > 3) moved = true;
        moveTo(dx, dy);
      };
      const key = ev => {if (ev.key === "Escape") {ev.preventDefault(); ev.stopPropagation(); stop(false);}};
      const release = ev => {if (ev.pointerId === event.pointerId) stop(ev.type === "pointerup");};
      const stop = persist => {
        handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", release);
        handle.removeEventListener("pointercancel", release); handle.removeEventListener("lostpointercapture", release);
        document.removeEventListener("keydown", key, true); window.removeEventListener("blur", cancel);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        active = null; paper.classList.remove("mkjb-note-dragging");
        if (persist && moved && canEdit()) commit(state, current);
        else {
          paper.className = before.classes;
          if (before.style === null) paper.removeAttribute("style"); else paper.setAttribute("style", before.style);
          state.position = before.position; state.space = before.space;
        }
      };
      const cancel = () => stop(false);
      active = cancel;
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", release);
      handle.addEventListener("pointercancel", release); handle.addEventListener("lostpointercapture", release);
      document.addEventListener("keydown", key, true); window.addEventListener("blur", cancel);
    });
    handle.addEventListener("keydown", event => {
      const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
      if (destroyed || !direction || active || !canEdit()) return;
      const current = read(uuid, id); if (!current) return;
      event.preventDefault(); event.stopPropagation();
      state.note = current;
      state.peek.reset(true);
      let position = state.position;
      if (state.space !== "page") {
        const old = metrics(state); state.space = "page"; const next = metrics(state);
        position = {x: next.rangeX ? clamp((old.left - next.minX) / next.rangeX) : .5, y: next.rangeY ? clamp((old.top - next.minY) / next.rangeY) : .5};
      }
      position ??= {x: 1, y: 0};
      const step = event.shiftKey ? .01 : .05;
      state.position = {x: clamp(position.x + direction[0] * step), y: clamp(position.y + direction[1] * step)};
      float(); place(state); handle.focus({preventScroll: true}); commit(state, current);
    });
  }
  return {layout, preview(uuid, id, rotation) {
    for (const state of states.values()) if (state.uuid === uuid && state.id === id) {state.note = {...state.note, rotation}; state.peek.reset(true); place(state);}
  }, cancel() {active?.(); for (const state of states.values()) state.peek.reset(true);}, destroy() {destroyed = true; active?.(); observer.disconnect(); for (const state of states.values()) state.peek.destroy();}};
}
