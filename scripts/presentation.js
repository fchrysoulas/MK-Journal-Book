import {ID, INDEX_UUID, canReadBook, collectPages, tagTabs} from "./core.js";

export function canReceivePresentation(book, user, pageUUID) {
  if (!user || user.isGM || user.active === false || !canReadBook(book, user)) return false;
  return pageUUID === INDEX_UUID || collectPages(game.journal, user, book).some(row => row.uuid === pageUUID);
}
/** The server restricts world-setting writes; no untrusted module socket sender is accepted. */
export async function presentPage(book, pageUUID, tab, userIds) {
  if (!game.user.isGM) throw new Error("Only a GM can show a book page to players.");
  if (!book || !game.journal.get(book.id) || !canReadBook(book, game.user)) throw new Error("Open a journal book first.");
  if (pageUUID !== INDEX_UUID && !collectPages(game.journal, game.user, book).some(row => row.uuid === pageUUID)) throw new Error("This page is no longer in the book.");
  const users = Array.from(game.users).filter(user => userIds.includes(user.id) && canReceivePresentation(book, user, pageUUID)).map(user => user.id);
  if (!users.length) throw new Error("Select connected players who can read this book and page.");
  await game.settings.set(ID, "pagePresentation", {bookUUID: book.uuid, pageUUID, tab, users, sender: game.user.id, at: Date.now(), nonce: `${Date.now()}-${Math.random()}`});
  return users.length;
}
let seen = "";
export async function receivePresentation(value, open) {
  const viewer = game.user;
  if (!value || !viewer || viewer.isGM || !Array.isArray(value.users) || !value.users.includes(viewer.id)
    || typeof value.nonce !== "string" || value.nonce === seen || typeof value.bookUUID !== "string" || typeof value.pageUUID !== "string"
    || !Number.isFinite(value.at) || Math.abs(Date.now() - value.at) > 30000
    || !Array.from(game.users).some(user => user.id === value.sender && user.isGM)) return false;
  seen = value.nonce;
  const book = await fromUuid(value.bookUUID);
  if (viewer !== game.user || !canReceivePresentation(book, viewer, value.pageUUID)) return false;
  const tab = tagTabs(collectPages(game.journal, viewer, book)).some(tag => tag.key === value.tab) ? value.tab : "all";
  await open({bookUUID: book.uuid, pageUUID: value.pageUUID, tab});
  return true;
}
