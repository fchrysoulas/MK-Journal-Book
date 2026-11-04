import {orderedPages} from "./ordering.js";
export const ID = "mk-journal-book";
export const CATEGORIES = ["locations", "characters", "notes"];
export const LABELS = {all: "All", locations: "Locations", characters: "Characters", notes: "Notes"};
export const TAG_MAX_LENGTH = 40;

export function normalizeTag(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, TAG_MAX_LENGTH) : "";
}
export function tagKey(value) {
  const tag = normalizeTag(value);
  return tag ? `tag:${tag.toLowerCase()}` : "untagged";
}
const TAG_COLORS = ["#495a4e", "#4c5661", "#735246", "#65506a", "#806643", "#456368"];
/** Generate tabs from readable, included pages only; custom names never become field paths. */
export function tagTabs(pages) {
  const tags = new Map();
  for (const page of pages) {
    const label = normalizeTag(page.tag), key = tagKey(label);
    if (!label) continue;
    if (!tags.has(key)) {
      let hash = 0;
      for (const char of key) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
      tags.set(key, {key, label, count: 0, color: TAG_COLORS[hash % TAG_COLORS.length]});
    }
    tags.get(key).count++;
  }
  return [{key: "all", label: "All", count: pages.length, color: "#5d5647"},
    ...Array.from(tags.values()).sort((a, b) => a.label.localeCompare(b.label))];
}

/** Old books retain their organization until a tag is edited; new books start untagged. */
export function pageTag(page, book = null) {
  if (!book) {
    const tag = page.getFlag(ID, "tag");
    return tag !== undefined ? normalizeTag(tag) : LABELS[categoryOf(page)];
  }
  const key = page.uuid.replaceAll(".", "~"), tags = book.getFlag(ID, "tags");
  if (tags && Object.hasOwn(tags, key)) return normalizeTag(tags[key]);
  if (book.getFlag(ID, "tagVersion") === 1) return "";
  const oldCategory = book.getFlag(ID, "categories")?.[key];
  return LABELS[CATEGORIES.includes(oldCategory) ? oldCategory : categoryOf(page)];
}

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
}

/** Delegate inherited and explicit page ownership to Foundry, never copy ownership. */
export function canReadPage(page, user) {
  if (!page || !user) return false;
  return page.testUserPermission(user, "OBSERVER") ||
    (page.type === "image" && page.testUserPermission(user, "LIMITED"));
}

export function included(page, user) {
  return page?.getFlag(ID, "included") === true && canReadPage(page, user);
}

/** Share only the selected page. Preserve existing Owner access and GM overrides. */
export function sharedOwnership(page, users) {
  const ownership = {...page.ownership};
  ownership.default = Math.max(2, ownership.default ?? 0);
  for (const user of users) {
    if (user.isGM) continue;
    ownership[user.id] = page.testUserPermission(user, "OWNER") ? 3 : 2;
  }
  return ownership;
}

export function categoryOf(page) {
  for (const doc of [page, page.parent]) {
    const category = doc?.getFlag(ID, "category");
    if (CATEGORIES.includes(category)) return category;
  }
  const aliases = {location: "locations", locations: "locations", character: "characters", characters: "characters", npc: "characters", npcs: "characters", note: "notes", notes: "notes"};
  let folder = page.parent?.folder;
  const visited = new Set();
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id);
    const category = aliases[String(folder.name).trim().toLowerCase()];
    if (category) return category;
    folder = folder.folder;
  }
  return "notes";
}

export const BOOK_SHEET_ID = `${ID}.MKJournalBookSheet`;
export function isBook(journal) {
  return journal?.documentName === "JournalEntry" && journal.getFlag(ID, "book") === true;
}
export function canReadBook(book, user) {
  return isBook(book) && book.testUserPermission(user, "OBSERVER");
}
export function canManageBook(book, user) {
  return isBook(book) && book.testUserPermission(user, "OWNER");
}
export function bookPageUUIDs(book) {
  const entries = book.getFlag(ID, "pages");
  return Array.isArray(entries) ? [...new Set(entries.filter(uuid => typeof uuid === "string"))] : [];
}
/** Check both existing players and the default inherited by future players. */
export function sharedWithPlayers(page, users) {
  const defaultLevel = page.ownership?.default;
  const effectiveDefault = defaultLevel == null || defaultLevel < 0 ? page.parent?.ownership?.default : defaultLevel;
  return effectiveDefault >= 2 && Array.from(users).filter(u => !u.isGM).every(u => page.testUserPermission(u, "OBSERVER"));
}

export function collectPages(journals, user, book = null) {
  if (book && !canReadBook(book, user)) return [];
  const selected = book ? new Set(bookPageUUIDs(book)) : null;
  const result = [];
  for (const journal of journals) {
    for (const page of journal.pages ?? []) {
      if (selected ? !selected.has(page.uuid) || !canReadPage(page, user) : !included(page, user)) continue;
      result.push({uuid: page.uuid, page, name: page.name, tag: pageTag(page, book),
        journalUuid: journal.uuid ?? journal.id,
        journal: journal.testUserPermission(user, "LIMITED") ? journal.name : "Shared journal"});
    }
  }
  const sorted = result.sort((a, b) => a.journal.localeCompare(b.journal) ||
    String(a.journalUuid ?? "").localeCompare(String(b.journalUuid ?? "")) ||
    (a.page.sort ?? 0) - (b.page.sort ?? 0) || a.name.localeCompare(b.name));
  return orderedPages(sorted, book?.getFlag(ID, "order"));
}

export function filterPages(pages, tab, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  return pages.filter(p => (tab === "all" || tagKey(p.tag) === tab) &&
    (!needle || `${p.name}\n${p.journal}`.toLocaleLowerCase().includes(needle)));
}

/** Local Foundry paths and HTTP(S) media only. Reject executable URL schemes. */
export function safeMediaURL(value) {
  const url = String(value ?? "").trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:/i.test(url)) return "";
  return url;
}

/** One row per parent journal, using only pages already selected and readable. */
export function buildJournalIndex(pages) {
  const journals = new Map();
  pages.forEach((row, index) => {
    const key = row.journalUuid ?? row.page.parent;
    if (!journals.has(key)) journals.set(key, {journalUuid: key, name: row.journal, uuid: row.uuid, pageNumber: index + 2, count: 0, pages: []});
    journals.get(key).count++;
    journals.get(key).pages.push({uuid: row.uuid, name: row.name, pageNumber: index + 2});
  });
  return Array.from(journals.values());
}

export const INDEX_UUID = "mk-journal-book-index";
export function bookSequence(pages, tab) {
  const filtered = filterPages(pages, tab, "");
  return tab === "all" ? [{uuid: INDEX_UUID, kind: "index", journals: buildJournalIndex(pages)}, ...filtered] : filtered;
}

export const FLIP_DURATION = {min: 0, max: 3000, step: 20, default: 520};
export function flipDuration(value) {
  const number = typeof value === "number" ? value : NaN;
  return Number.isFinite(number) ? Math.min(FLIP_DURATION.max, Math.max(FLIP_DURATION.min, Math.round(number))) : FLIP_DURATION.default;
}
