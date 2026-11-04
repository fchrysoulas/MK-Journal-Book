import {resolveBookPreset, coverURL} from "./presets.js";
import {escapeHTML as e, tagTabs} from "./core.js";
import {normalizePageNote, noteRotation} from "./notes.js";

function bookmarkButton(uuid, bookmarks) {
  const saved = bookmarks.find(mark => mark.uuid === uuid);
  const label = saved ? "Edit bookmark" : "Bookmark this page";
  return `<button type="button" class="mkjb-bookmark-toggle ${saved ? "is-bookmarked" : ""}" data-mkjb-action="bookmark" title="${label}" aria-label="${label}" ${saved ? `style="--ribbon-color:${saved.color}"` : ""}><svg viewBox="0 0 16 20" width="12" height="16" aria-hidden="true"><path d="M3 2H13V18L8 14L3 18Z"/></svg></button>`;
}

function noteButton(row, canManage, note) {
  if (!canManage && !note) return "";
  const label = canManage ? (note ? "Edit page note" : "Add page note") : "View page note";
  return `<button type="button" class="mkjb-note-toggle ${note ? "has-note" : ""}" data-mkjb-action="${canManage ? "note" : "view-note"}" title="${label}" aria-label="${label} for ${e(row.name)}"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M4 3H10M3 4V17H16V10M7 13L8 9L15 2L18 5L11 12Z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg><span>${note ? `Note${row.notes?.length > 1 ? ` (${row.notes.length})` : ""}` : "+ Note"}</span></button>`;
}

function renderPageNote(row, note, canManage) {
  if (!note) return "";
  const date = note.updatedAt ? new Date(note.updatedAt) : null;
  const edited = [note.authorName ? `Last edited by ${note.authorName}` : "Page note", date?.toLocaleString()].filter(Boolean).join(" · ");
  return `<aside class="mkjb-page-note mkjb-note-style-${note.style} mkjb-note-positioned" data-note-id="${e(note.id ?? "primary")}" style="--mkjb-note-angle:${noteRotation(note)}deg" aria-label="Page note for ${e(row.name)}" title="${e(edited)}"><div class="mkjb-note-sheet">
    <button type="button" class="mkjb-note-pin" data-mkjb-note-pin aria-label="Pin note open" aria-pressed="false" title="Pin note open"><svg viewBox="0 0 20 20" width="13" height="15" aria-hidden="true"><path d="M7 2H13L12 7L15 10V12H5V10L8 7ZM10 12V18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    ${note.title || canManage ? `<div class="mkjb-note-heading${note.title ? "" : " is-untitled"}">${note.title ? `<span class="mkjb-note-title">${e(note.title)}</span>` : ""}${canManage ? '<span class="mkjb-note-controls"><button type="button" class="mkjb-note-move" data-mkjb-note-move title="Drag to move this note. Arrow keys move; Shift moves in smaller steps." aria-label="Move note">✥</button><button type="button" class="mkjb-note-edit" data-mkjb-action="note" title="Edit this note" aria-label="Edit this note">✎</button></span>' : ""}</div>` : ""}
    <div class="mkjb-note-text" data-uuid="${e(row.uuid)}" tabindex="0" aria-keyshortcuts="Space Escape" aria-description="${e(edited)}">${e(note.text)}</div>
    ${canManage ? '<button type="button" class="mkjb-note-resize" data-mkjb-note-resize aria-label="Resize note" title="Drag to resize. Arrow keys adjust size.">⌟</button>' : ""}
  </div></aside>`;
}

function renderLeaf(row, isGM, bookmarks) {
  if (!row) return "";
  const notes = row.notes ?? (normalizePageNote(row.note) ? [{...normalizePageNote(row.note), id: "primary"}] : []);
  const note = notes[0];
  return `<div class="mkjb-page-meta"><span class="mkjb-page-tag" title="${e(row.tag || "No tag")}">${row.tag ? `#${e(row.tag)}` : "No tag"}</span><span class="mkjb-page-tools">${noteButton(row, isGM, note)}${isGM && notes.length ? '<button type="button" data-mkjb-action="add-note" title="Add another note" aria-label="Add another note">+</button>' : ""}${bookmarkButton(row.uuid, bookmarks)}</span></div>
    <h1 class="mkjb-page-title">${e(row.name)}</h1><div class="mkjb-source"><button type="button" class="mkjb-source-link" data-mkjb-action="original" title="Open this page in its original journal" aria-label="Open ${e(row.journal)} at ${e(row.name)}">${e(row.journal)}</button></div>
    ${isGM ? `<div class="mkjb-page-admin"><button type="button" class="mkjb-tag-edit" data-mkjb-action="tag" title="${e(row.tag ? `Edit tag: ${row.tag}` : "Add a tag to this page")}" aria-label="Edit tag for ${e(row.name)}">${row.tag ? `Tag: ${e(row.tag)}` : "+ Add tag"}</button><button type="button" class="mkjb-remove" data-mkjb-action="remove" title="Remove from the book; sharing stays unchanged">Remove</button></div>` : ""}
    <div class="mkjb-page-body"><article class="mkjb-content journal-entry-content" data-uuid="${e(row.uuid)}" tabindex="0">${row.content}</article></div>
    ${note ? `<div class="mkjb-note-area">${notes.map(item => renderPageNote(row, item, isGM)).join("")}</div>` : ""}`;
}

function renderIndex(row, isGM, bookmarks, collapsed = new Set(), canReorder = false) {
  const entries = row.journals.map(journal => `<li class="mkjb-index-journal">
    <div class="mkjb-index-group" data-order-kind="journal" data-order-id="${e(journal.journalUuid)}">
    <button type="button" data-mkjb-collapse="${e(journal.journalUuid)}" class="mkjb-index-collapse" aria-expanded="${!collapsed.has(journal.journalUuid)}" aria-label="Toggle pages in ${e(journal.name)}">${collapsed.has(journal.journalUuid) ? "▸" : "▾"}</button>
    ${canReorder ? `<button type="button" draggable="true" data-order-handle class="mkjb-index-grip" title="Drag journal to reorder; Alt+Up/Down moves it" aria-label="Reorder ${e(journal.name)}">⠿</button>` : ""}
    <button type="button" class="mkjb-index-heading" data-mkjb-jump="${e(journal.uuid)}" title="${e(journal.name)}" aria-label="Open ${e(journal.name)} at page ${journal.pageNumber}"><span class="mkjb-index-title"><strong>${e(journal.name)}</strong><small>(${journal.count})</small></span><span class="mkjb-index-leader" aria-hidden="true"></span><span class="mkjb-index-number">${journal.pageNumber}</span></button>
    </div><ol ${collapsed.has(journal.journalUuid) ? "hidden" : ""} class="mkjb-index-pages" aria-label="Pages in ${e(journal.name)}">${journal.pages.map(page => `<li data-order-kind="page" data-order-id="${e(page.uuid)}">${canReorder ? '<button type="button" draggable="true" data-order-handle class="mkjb-index-grip" title="Drag page within its journal; Alt+Up/Down moves it" aria-label="Reorder page">⠿</button>' : ""}<button type="button" class="mkjb-index-page" data-mkjb-jump="${e(page.uuid)}" title="${e(page.name)}" aria-label="Open ${e(page.name)} at page ${page.pageNumber}"><span class="mkjb-index-page-name">${e(page.name)}</span><span class="mkjb-index-leader" aria-hidden="true"></span><span class="mkjb-index-number">${page.pageNumber}</span></button></li>`).join("")}</ol>
  </li>`).join("");
  return `<div class="mkjb-page-meta"><span>The collected journals</span><span class="mkjb-page-tools">${bookmarkButton(row.uuid, bookmarks)}<span>${row.journals.length} ${row.journals.length === 1 ? "journal" : "journals"}</span></span></div><h1 class="mkjb-page-title">Journal Index</h1><div class="mkjb-source">Select a journal or page to turn to it.</div><ol class="mkjb-journal-index">${entries || `<li class="mkjb-index-empty">${isGM ? "Drag a journal or page into the book to begin." : "No journals have been added yet."}</li>`}</ol>`;
}

export function renderBook({title, pages, filtered, leaves = [], start = 0, tab, isGM, canPublish = isGM, bookmarks = [], preset = "classic", searchOpen = false, query = "", collapsed = new Set(), canReorder = false, canPresent = false, cover = null}) {
  const tabs = tagTabs(pages).map(({key, label, count, color}) => `<button type="button" class="mkjb-tab ${key === tab ? "active" : ""}" data-mkjb-tab="${e(key)}" style="--tag-color:${color}" aria-pressed="${key === tab}" title="${e(label)} · ${count} ${count === 1 ? "page" : "pages"}" aria-label="${e(key.startsWith("tag:") ? `Tag: ${label}` : label)}, ${count} ${count === 1 ? "page" : "pages"}"><span>${e(label)}</span><small>${count}</small></button>`).join("");
  const empty = `<div class="mkjb-empty"><div class="mkjb-empty-mark" aria-hidden="true">✦</div><h1>${isGM ? "Drop a journal here" : "A story waiting<br>to be told."}</h1><p>${isGM ? (canPublish ? "Drag a journal or an individual page from Foundry into the book to add it and share it with all players." : "Drag a journal or page already shared with all players into your book.") : "No pages have been added to this section yet."}</p></div>`;
  return `<section class="mkjb-shell" data-mkjb-style="${resolveBookPreset(preset)}">
    <img class="mkjb-cover-preload" src="${e(cover?.image || coverURL(preset))}" alt="" aria-hidden="true" hidden>
    <nav class="mkjb-tabs" aria-label="Page tags">${tabs}</nav>
    <div class="mkjb-book">
      <section class="mkjb-search" aria-label="Search this book" ${searchOpen ? "" : "hidden"}>
        <div class="mkjb-search-bar"><input type="search" maxlength="200" data-mkjb-search value="${e(query)}" placeholder="Search titles and page text…" aria-label="Search included pages"><button type="button" data-mkjb-action="search" aria-label="Close search">×</button></div>
        <p class="mkjb-search-status" role="status">Search all pages included in this book.</p><ol class="mkjb-search-results"></ol>
      </section>
      <div class="mkjb-drag-strip" data-mkjb-move title="Drag the book to move it" aria-hidden="true"></div>
      <section class="mkjb-left" data-mkjb-leaf="${e(leaves[0]?.uuid ?? "")}" aria-label="Left journal page">
        <div class="mkjb-leaf-header"><div class="mkjb-kicker" data-mkjb-move title="Drag to move the book">${e(title)}</div></div>
        ${leaves[0]?.kind === "index" ? renderIndex(leaves[0], isGM, bookmarks, collapsed, canReorder) : leaves[0] ? renderLeaf(leaves[0], isGM, bookmarks) : empty}
        <footer class="mkjb-pagination"><button type="button" data-mkjb-action="previous" ${start <= 0 ? "disabled" : ""} aria-label="Previous spread">← Previous</button><span>${leaves[0] ? start + 1 : ""}</span></footer>
      </section>
      <section class="mkjb-right" data-mkjb-leaf="${e(leaves[1]?.uuid ?? "")}" aria-label="Right journal page">
        <div class="mkjb-leaf-header"><div class="mkjb-book-controls">${canPresent ? '<button type="button" data-mkjb-action="present" title="Show this spread to players" aria-label="Show this spread to players"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="9" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 20V17C3 11 15 11 15 17V20M16 4C21 4 21 10 16 10M18 13C21 13 22 15 22 18V20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' : ""}${isGM ? '<button type="button" data-mkjb-action="appearance" title="Book style" aria-label="Book style"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3C6 3 3 7 3 12S7 21 12 21C15 21 14 17 17 17H18C22 17 22 11 20 8C18 5 15 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="13" cy="6.5" r="1.4" fill="currentColor"/><circle cx="17.5" cy="10" r="1.4" fill="currentColor"/><circle cx="6.5" cy="13" r="1.4" fill="currentColor"/></svg></button>' : ""}<button type="button" data-mkjb-action="search" title="Search this book" aria-label="Search this book">⌕</button><button type="button" data-mkjb-action="index" title="Go to the journal index" aria-label="Go to the journal index">☷</button><button type="button" data-mkjb-action="refresh" title="Refresh book" aria-label="Refresh book">↻</button><button type="button" data-mkjb-action="close" title="Close book" aria-label="Close book">×</button></div></div>
        ${leaves[1] ? renderLeaf(leaves[1], isGM, bookmarks) : '<div class="mkjb-blank" aria-label="Blank page"><span aria-hidden="true">◆</span></div>'}
        <footer class="mkjb-pagination"><span>${leaves[1] ? start + 2 : ""}</span><button type="button" data-mkjb-action="next" ${start + 2 >= filtered.length ? "disabled" : ""} aria-label="Next spread">Next →</button></footer>
      </section>
      ${bookmarks.length ? `<nav class="mkjb-ribbons" aria-label="Your bookmarks">${bookmarks.map(mark => `<button type="button" class="mkjb-ribbon ${leaves.some(row => row.uuid === mark.uuid) ? "is-current" : ""}" data-mkjb-ribbon="${e(mark.uuid)}" style="--ribbon-color:${mark.color}" title="${e(mark.label)} · Page ${mark.pageNumber} · Right-click to edit" aria-label="Bookmark: ${e(mark.label)}, page ${mark.pageNumber}. Press F2 to edit."><span>${mark.pageNumber}</span></button>`).join("")}</nav>` : ""}
      <span class="mkjb-resize" data-mkjb-resize title="Drag to resize the book" aria-hidden="true">⌟</span>
      ${isGM ? `<div class="mkjb-drop-hint" aria-hidden="true">${canPublish ? "Drop to add and share with players" : "Drop to add to this book"}</div>` : ""}
    </div>
  </section>`;
}
