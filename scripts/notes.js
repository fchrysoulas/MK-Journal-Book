import {ID, escapeHTML as e} from "./core.js";

export const NOTE_MAX_LENGTH = 2000;
export const NOTE_TITLE_MAX_LENGTH = 80;
export const NOTE_STYLES = {parchment: "Parchment", sticky: "Yellow Sticky Note", torn: "Torn Paper"};
export const isNoteStyle = value => typeof value === "string" && Object.hasOwn(NOTE_STYLES, value);
export const resolveNoteStyle = value => isNoteStyle(value) ? value : "parchment";
export function noteStyleOptions(value) {
  const selected = resolveNoteStyle(value);
  return Object.entries(NOTE_STYLES).map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${e(label)}</option>`).join("");
}
export const noteKey = uuid => uuid.replaceAll(".", "~");
export const NOTE_MAX_TILT = 20;
export const validNoteSize = value => value && typeof value === "object" && !Array.isArray(value)
  && Number.isFinite(value.width) && value.width >= 140 && value.width <= 420
  && Number.isFinite(value.height) && value.height >= 80 && value.height <= 420;
export const validNoteId = value => value === "primary" || (typeof value === "string" && /^n[a-zA-Z0-9_-]{1,63}$/.test(value));
export function newNoteId() {return `n${Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, "0")).join("")}`;}

export const validNotePosition = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && [value.x, value.y].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1);
export const validNoteRotation = value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= NOTE_MAX_TILT;
export const noteRotation = note => validNoteRotation(note?.rotation) ? note.rotation : ({parchment: 1.2, sticky: -1.2, torn: -.7}[resolveNoteStyle(note?.style)]);
export const notePosition = note => validNotePosition(note?.position) ? note.position : validNoteRotation(note?.rotation) ? {x: 1, y: 0} : null;

/** Keep the rotated paper inside its page, scaling down only when needed. */
export function notePlacement(width, height, paperWidth, paperHeight, rotation, position = {x: .5, y: .5}) {
  const angle = rotation * Math.PI / 180, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const rotatedWidth = paperWidth * cos + paperHeight * sin, rotatedHeight = paperWidth * sin + paperHeight * cos;
  const scale = Math.max(.001, Math.min(1, Math.max(0, width - 20) / rotatedWidth, Math.max(0, height - 20) / rotatedHeight));
  const minX = (rotatedWidth * scale - paperWidth) / 2 + 10, minY = (rotatedHeight * scale - paperHeight) / 2 + 10;
  const rangeX = Math.max(0, width - paperWidth - minX * 2), rangeY = Math.max(0, height - paperHeight - minY * 2);
  return {left: minX + rangeX * position.x, top: minY + rangeY * position.y, minX, minY, rangeX, rangeY, scale};
}

export function noteText(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, NOTE_MAX_LENGTH) : "";
}

export function noteTitle(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, NOTE_TITLE_MAX_LENGTH) : "Page note";
}

/** Notes are plain text. Stored metadata cannot inject markup or invalid dates. */
export function normalizePageNote(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const text = noteText(value.text);
  if (!text) return null;
  return {
    text,
    ...(validNoteSize(value.size) ? {size: {width: value.size.width, height: value.size.height}} : {}),
    title: noteTitle(value.title),
    style: resolveNoteStyle(value.style),
    position: validNotePosition(value.position) ? {x: value.position.x, y: value.position.y} : null,
    positionSpace: value.positionSpace === "page" ? "page" : "content",
    rotation: validNoteRotation(value.rotation) ? value.rotation : null,
    authorId: typeof value.authorId === "string" ? value.authorId.slice(0, 64) : "",
    authorName: typeof value.authorName === "string" ? value.authorName.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) : "",
    updatedAt: Number.isSafeInteger(value.updatedAt) && value.updatedAt > 0 && value.updatedAt <= 8640000000000000 ? value.updatedAt : null
  };
}

export function pageNotes(page, book = null) {
  const primary = pageNote(page, book);
  const extra = book ? book.getFlag(ID, "extraNotes")?.[noteKey(page.uuid)] : page.getFlag(ID, "extraNotes");
  return [...(primary ? [{...primary, id: "primary"}] : []), ...Object.entries(extra ?? {}).flatMap(([id, value]) => {
    const note = normalizePageNote(value);
    return id !== "primary" && validNoteId(id) && note ? [{...note, id}] : [];
  })];
}
export function getNote(page, book = null, id = "primary") {
  if (id === "primary") return pageNote(page, book);
  return normalizePageNote(book ? book.getFlag(ID, "extraNotes")?.[noteKey(page.uuid)]?.[id] : page.getFlag(ID, "extraNotes")?.[id]);
}
export function pageNote(page, book = null) {
  if (!book) return normalizePageNote(page.getFlag(ID, "note"));
  const notes = book.getFlag(ID, "notes"), key = noteKey(page.uuid);
  return notes && Object.hasOwn(notes, key) ? normalizePageNote(notes[key]) : null;
}

export function makePageNote(value, user, now = Date.now(), style = "parchment", title = "Page note", {position = null, rotation = null, positionSpace = "page", size = null} = {}) {
  if (typeof value !== "string") throw new Error("A page note must be text.");
  if (value.length > NOTE_MAX_LENGTH) throw new Error(`Keep page notes within ${NOTE_MAX_LENGTH} characters.`);
  if (!isNoteStyle(style)) throw new Error("Choose a valid note style.");
  if (typeof title !== "string" || title.length > NOTE_TITLE_MAX_LENGTH) throw new Error(`Keep note titles within ${NOTE_TITLE_MAX_LENGTH} characters.`);
  if (position !== null && !validNotePosition(position)) throw new Error("Choose a note position within its page.");
  if (rotation !== null && !validNoteRotation(rotation)) throw new Error(`Keep note tilt between -${NOTE_MAX_TILT}° and ${NOTE_MAX_TILT}°.`);
  if (!["page", "content"].includes(positionSpace)) throw new Error("Choose a valid note coordinate space.");
  if (size !== null && !validNoteSize(size)) throw new Error("Choose a note size between 140–420 px wide and 80–420 px high.");
  return normalizePageNote({size, text: value, title, style, position, rotation, positionSpace, authorId: user.id, authorName: user.name, updatedAt: now});
}
