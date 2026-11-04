import {ID, FLIP_DURATION, flipDuration, CATEGORIES, LABELS, TAG_MAX_LENGTH, normalizeTag, tagKey, tagTabs, canReadPage, isBook, canReadBook, canManageBook, bookPageUUIDs, sharedWithPlayers, collectPages, filterPages, bookSequence, INDEX_UUID, safeMediaURL, sharedOwnership, escapeHTML as e} from "./core.js";
import {savedBookmarks, visibleBookmarks, updatedBookmarks, RIBBON_COLORS, ribbonColor} from "./bookmarks.js";
import {BOOK_PRESETS, isBookPreset, resolveBookPreset, presetOptions} from "./presets.js";
import {renderBook} from "./view.js";
import {snapshotLeaf, holdSpread, animateSpread, animateBookClose, animateBookOpen} from "./flip.js";
import {registerJournalIntegration} from "./journals.js";
import {BookSounds, registerSoundSettings} from "./sounds.js";
import {NOTE_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH, NOTE_MAX_TILT, pageNote, pageNotes, getNote, validNoteId, newNoteId, noteKey, makePageNote, noteStyleOptions, noteRotation} from "./notes.js";
import {bindNoteLayout} from "./note-layout.js";

import {readingPosition, isReadingPositionUpdate, searchableText, searchExcerpt, searchResultsHTML} from "./reading.js";

import {reorderedUUIDs, mergeVisibleOrder} from "./ordering.js";

import {presentPage, receivePresentation, canReceivePresentation} from "./presentation.js";
import {coverDetails, normalizeCover, fillCover} from "./cover.js";
import {viewBookImage} from "./image-viewer.js";

const {ApplicationV2, DocumentSheetV2} = foundry.applications.api;
const openApps = new Set();

const BookApplication = Base => class extends Base {
  static DEFAULT_OPTIONS = {
    id: ID, classes: ["mk-journal-book"], tag: "div",
    window: {title: "MK Journal Book", icon: "fa-solid fa-book-open", resizable: false, minimizable: false, frame: true, positioned: true},
    position: {width: 1120, height: 780}
  };

  _collapsedJournals = new Set();
  _orderPending = false;
  searchOpen = false;
  searchQuery = "";
  _searchToken = 0;
  _searchTimer = null;
  _rememberTimer = null;
  _readerId = null;
  tab = "all";
  selectedUUID = null;
  _revision = 0;
  _refreshTimer = null;
  _dropPending = false;
  _bookmarkPending = false;
  _appearancePending = false;
  _presentationPending = false;
  _imageViewer = null;
  _tagPending = false;
  _notePending = false;
  _pinnedNotes = new Set();
  _viewedNotes = new Map();
  _noteFront = 0;
  _noteLayout = null;
  _noteFocusUUID = null;
  _openedOnce = false;
  _turnPending = false;
  _turnToken = 0;
  _turnAnimation = null;
  _turnPreparation = null;
  _closing = false;
  _closePromise = null;
  _closeAnimation = null;
  _opening = false;
  _openPromise = null;
  _openAnimation = null;
  _openToken = 0;
  _sounds = new BookSounds();

  get journal() { return null; }
  get canManage() { return this.journal ? canManageBook(this.journal, game.user) : game.user.isGM; }
  get preset() { return resolveBookPreset(this.journal?.getFlag(ID, "style"), game.settings.get(ID, "bookStyle")); }
  get cover() {return coverDetails(this.journal?.getFlag(ID, "cover") ?? game.settings.get(ID, "legacyCover"), this.journal?.name ?? game.settings.get(ID, "bookTitle"), this.preset);}
  get pages() { return collectPages(game.journal, game.user, this.journal).map(row => ({...row, note: pageNote(row.page, this.journal), notes: pageNotes(row.page, this.journal)})); }
  get bookmarkKey() { return this.journal?.id ?? "legacy"; }
  get bookmarks() { return visibleBookmarks(savedBookmarks(game.user, this.bookmarkKey), this.pages); }
  async render(options = {}, ...args) {
    if (this._closing) return this;
    if (this.journal && (!game.journal.get(this.journal.id) || !canReadBook(this.journal, game.user))) {
      if (this.rendered) await this.close({animate: false, sound: false});
      return this;
    }
    if (this._opening) return this._openPromise ?? this;
    const duration = flipDuration(game.settings.get(ID, "flipDuration"));
    const animateOpening = !this.rendered && options.animate !== false && duration > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.rendered && !this.selectedUUID) {
      const position = readingPosition(game.user, this.bookmarkKey, this.pages, game.settings.get(ID, "alwaysStartAtIndex"));
      this.tab = position.tab; this.selectedUUID = position.uuid;
    }
    this._readerId = game.user.id;
    if (!this._openedOnce) {
      const width = Math.max(640, Math.min(1120, window.innerWidth - 40));
      const height = Math.max(440, Math.min(780, window.innerHeight - 60));
      Object.assign(this.position, {width, height,
        left: Math.max(0, Math.round((window.innerWidth - width) / 2)),
        top: Math.max(0, Math.round((window.innerHeight - height) / 2))});
      this._openedOnce = true;
    }
    openApps.add(this);
    if (this.rendered) {
      const app = await super.render(options, ...args);
      this._noteLayout?.layout();
      return app;
    }
    this._opening = true;
    const token = ++this._openToken;
    this._openPromise = (async () => {
      let rendered = false;
      try {
        await super.render(options, ...args);
        rendered = true;
        if (token !== this._openToken || this._closing || !this.rendered) return this;
        this.bringToFront();
        const shell = this.element?.querySelector(".mkjb-shell");
        const image = shell?.querySelector(".mkjb-cover-preload");
        // Give a first-use cover time to decode without blocking the window indefinitely.
        let timeout;
        try {
          if (animateOpening && image?.decode) await Promise.race([image.decode().catch(() => {}), new Promise(resolve => {timeout = setTimeout(resolve, 400);})]);
        } finally {clearTimeout(timeout);}
        if (token !== this._openToken || this._closing || !this.rendered) return this;
        const container = shell?.querySelector(".mkjb-book");
        // Foundry can build the HTML before mounting the window. Finish note
        // layout after mounting, before the first animation snapshot is cloned.
        this._noteLayout?.layout();
        if (animateOpening && container) this._openAnimation = animateBookOpen(container, {duration, title: this.journal?.name ?? game.settings.get(ID, "bookTitle"), cover: this.cover});
        if (options.sound !== false) this._sounds.play("open", {delay: this._openAnimation ? 400 : 0});
        shell?.classList.remove("mkjb-opening-pending");
        await this._openAnimation?.finished;
      } catch (error) {
        if (!rendered && token === this._openToken) throw error;
        console.warn("MK Journal Book | Opening animation skipped", error);
      }
      finally {if (token === this._openToken) this.cancelBookOpen({stopSound: false});}
      return this;
    })();
    return this._openPromise;
  }
  get filtered() { return filterPages(this.pages, this.tab, ""); }
  get sequence() { return bookSequence(this.pages, this.tab); }
  resolvePage(uuid = this.selectedUUID) {
    return this.pages.find(row => row.uuid === uuid)?.page ?? null;
  }

  async _renderHTML() {
    const revision = this._revision;
    const pages = this.pages;
    if (!tagTabs(pages).some(tag => tag.key === this.tab)) { this.tab = "all"; this.selectedUUID = INDEX_UUID; }
    const filtered = bookSequence(pages, this.tab);
    const foundIndex = filtered.findIndex(p => p.uuid === this.selectedUUID);
    const start = Math.floor(Math.max(0, foundIndex) / 2) * 2;
    const spread = filtered.slice(start, start + 2);
    this.selectedUUID = spread[0]?.uuid ?? null;
    const leaves = await Promise.all(spread.map(async row => {
      if (row.kind === "index") return row;
      let content;
      try { content = await this.renderPage(row.page); }
      catch (error) {
        console.error("MK Journal Book | Could not render page", error);
        content = '<p>This page could not be displayed. Click the journal name above to view it in Foundry.</p>';
      }
      return {...row, content};
    }));
    return {revision, html: renderBook({title: this.journal?.name ?? game.settings.get(ID, "bookTitle"), pages, preset: this.preset,
      cover: this.cover, canPresent: game.user.isGM && Boolean(this.journal), collapsed: this._collapsedJournals, searchOpen: this.searchOpen, query: this.searchQuery, bookmarks: visibleBookmarks(savedBookmarks(game.user, this.bookmarkKey), pages), filtered, leaves, start, tab: this.tab, isGM: this.canManage, canPublish: game.user.isGM, canReorder: Boolean(this.journal) && this.canManage})};
  }

  _replaceHTML(result, content) {
    if (this._closing) return;
    this._noteLayout?.destroy(); this._noteLayout = null;
    if (result.revision !== this._revision) {
      content.replaceChildren(); this.refresh(); return;
    }
    const scrollKey = el => `${el.classList.contains("mkjb-note-text") ? `note:${el.closest("[data-note-id]")?.dataset.noteId}` : "page"}:${el.dataset.uuid}`;
    const scroll = new Map(Array.from(content.querySelectorAll(".mkjb-content,.mkjb-note-text"), el => [scrollKey(el), el.scrollTop]));
    const active = document.activeElement;
    const focusedNote = this._noteFocusUUID ?? (active?.matches("[data-mkjb-note-move],[data-mkjb-note-resize]") ? {uuid: active.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf, id: active.closest("[data-note-id]")?.dataset.noteId, resize: active.matches("[data-mkjb-note-resize]")} : null);
    this._noteFocusUUID = null;
    content.innerHTML = result.html;
    if (this._opening) {
      content.querySelector(".mkjb-shell")?.classList.add("mkjb-opening-pending");
      if (this.element) {this.element.inert = true; this.element.setAttribute("aria-busy", "true");}
    }
    const tabList = content.querySelector(".mkjb-tabs"), activeTab = tabList?.querySelector(".active");
    if (activeTab) tabList.scrollTop = Math.max(0, activeTab.offsetTop - (tabList.clientHeight - activeTab.offsetHeight) / 2);
    content.querySelectorAll(".mkjb-content,.mkjb-note-text").forEach(el => { el.scrollTop = scroll.get(scrollKey(el)) ?? 0; });
    content.querySelectorAll("[data-mkjb-tab]").forEach(button => button.addEventListener("click", () => {
      this.tab = button.dataset.mkjbTab; this.selectedUUID = null; this.refresh();
    }));
    content.querySelectorAll("[data-mkjb-jump]").forEach(button => button.addEventListener("click", () => {
      if (!this.resolvePage(button.dataset.mkjbJump)) return;
      this.tab = "all"; this.selectedUUID = button.dataset.mkjbJump; this.refresh();
    }));
    content.querySelectorAll("[data-mkjb-move]").forEach(handle => this.bindPositionHandle(handle, false));
    this.bindPositionHandle(content.querySelector("[data-mkjb-resize]"), true);
    content.querySelectorAll("[data-mkjb-action]").forEach(button => button.addEventListener("click", () => {
      const uuid = button.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf;
      void this.handleAction(button.dataset.mkjbAction, uuid, button.closest("[data-note-id]")?.dataset.noteId).catch(error => {
        console.error(error); ui.notifications.error("MK Journal Book: the action could not be completed.");
      });
    }));
    content.querySelectorAll("[data-mkjb-ribbon]").forEach(button => {
      button.addEventListener("click", () => {
        const uuid = button.dataset.mkjbRibbon;
        if (!this.bookmarks.some(mark => mark.uuid === uuid)) return;
        this.tab = "all"; this.selectedUUID = uuid; this.refresh();
      });
      const edit = event => {
        event.preventDefault(); event.stopPropagation();
        void this.editBookmark(button.dataset.mkjbRibbon).catch(error => {console.error(error); ui.notifications.error("Could not save the bookmark.");});
      };
      button.addEventListener("contextmenu", edit);
      button.addEventListener("keydown", event => {if (event.key === "F2" || (event.key === "F10" && event.shiftKey)) edit(event);});
    });
    content.querySelectorAll(".mkjb-content img").forEach(image => {
      image.tabIndex = 0; image.setAttribute("role", "button"); image.title = "Click to enlarge";
      const show = event => {
        if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (this._opening || this._closing || this._turnPending) return;
        const uuid = image.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf, viewer = game.user;
        this._imageViewer?.close();
        this._imageViewer = viewBookImage(image, {valid: () => viewer === game.user && this.rendered && Boolean(this.resolvePage(uuid))});
      };
      image.addEventListener("click", show); image.addEventListener("keydown", show);
    });
    this.bindIndexOrdering(content);
    this.bindSearch(content);
    this.scheduleReadingPosition();
    this.bindDropTarget(content.querySelector(".mkjb-shell"));
    const viewer = game.user;
    this._noteLayout = bindNoteLayout(content, {
      read: (uuid, id) => {const page = this.resolvePage(uuid); return page ? getNote(page, this.journal, id) : null;},
      peekOptions: (uuid, id) => ({delay: game.settings.get(ID, "noteHoverDelay"), duration: game.settings.get(ID, "noteFoldDuration"), pinned: this._pinnedNotes.has(`${viewer.id}:${uuid}:${id}`), onPin: pinned => {const key = `${viewer.id}:${uuid}:${id}`; if (pinned) this._pinnedNotes.add(key); else this._pinnedNotes.delete(key);}}),
      canPeek: () => viewer === game.user && !this._opening && !this._closing && !this._turnPending,
      canEdit: () => viewer === game.user && this.canManage && !this._notePending && !this._opening && !this._closing && !this._turnPending,
      save: async (uuid, note, position, noteId, size, positionSpace) => {
        if (viewer !== game.user || !this.canManage || !this.resolvePage(uuid)) throw new Error("You can no longer move this note.");
        if (document.activeElement?.matches("[data-mkjb-note-move],[data-mkjb-note-resize]")) this._noteFocusUUID = {uuid, id: noteId, resize: document.activeElement.matches("[data-mkjb-note-resize]")};
        this._notePending = true;
        try {await setPageNote(uuid, note.text, this.journal, {expected: JSON.stringify(note), position, noteId, size, positionSpace});}
        finally {this._notePending = false; this.refresh();}
      },
      error: error => {console.warn("MK Journal Book | Note position was not saved", error); ui.notifications.warn(error.message || "Could not move the note.");}
    });
    if (focusedNote) Array.from(content.querySelectorAll(focusedNote.resize ? "[data-mkjb-note-resize]" : "[data-mkjb-note-move]")).find(el => el.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf === focusedNote.uuid && el.closest("[data-note-id]")?.dataset.noteId === focusedNote.id)?.focus({preventScroll: true});
    // Attach in the same task as the HTML swap, before Foundry can paint a frame.
    if (this._turnPending) this._turnPreparation?.mount(content.querySelector(".mkjb-book"));
  }

  bindIndexOrdering(content) {
    content.querySelectorAll("[data-mkjb-collapse]").forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.mkjbCollapse, hidden = !this._collapsedJournals.has(key);
      if (hidden) this._collapsedJournals.add(key); else this._collapsedJournals.delete(key);
      button.setAttribute("aria-expanded", String(!hidden)); button.textContent = hidden ? "▸" : "▾";
      button.closest(".mkjb-index-journal").querySelector(".mkjb-index-pages").hidden = hidden;
    }));
    content.querySelectorAll("[data-order-handle]").forEach(handle => {
      const row = handle.closest("[data-order-kind]");
      handle.addEventListener("dragstart", event => {
        if (!this.journal || !this.canManage || this._orderPending) {event.preventDefault(); return;}
        event.stopPropagation(); event.dataTransfer.effectAllowed = "move";
        const data = JSON.stringify({type: "MKJournalBookOrder", book: this.bookmarkKey, kind: row.dataset.orderKind, source: row.dataset.orderId});
        event.dataTransfer.setData("application/x-mkjb-order", data); event.dataTransfer.setData("text/plain", data);
      });
      handle.addEventListener("keydown", event => {
        if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const kind = row.dataset.orderKind, source = row.dataset.orderId;
        const rows = this.pages, ids = kind === "journal" ? [...new Set(rows.map(p => p.journalUuid))] : rows.filter(p => p.journalUuid === rows.find(p => p.uuid === source)?.journalUuid).map(p => p.uuid);
        const direction = event.key === "ArrowDown" ? 1 : -1, target = ids[ids.indexOf(source) + direction];
        if (target) void this.reorderIndex(source, target, kind, direction > 0);
      });
    });
    content.querySelectorAll("[data-order-kind]").forEach(row => {
      row.addEventListener("dragover", event => {if (!Array.from(event.dataTransfer?.types ?? []).includes("application/x-mkjb-order")) return; if (this.canManage) {event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";}});
      row.addEventListener("drop", event => {
        let data; try {data = JSON.parse(event.dataTransfer.getData("text/plain"));} catch {return;}
        if (data.type !== "MKJournalBookOrder") return;
        event.preventDefault(); event.stopPropagation();
        if (data.book !== this.bookmarkKey || data.kind !== row.dataset.orderKind) return;
        const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        void this.reorderIndex(data.source, row.dataset.orderId, data.kind, after);
      });
    });
  }

  async reorderIndex(source, target, kind, after) {
    if (!this.journal || !this.canManage || this._orderPending) return;
    this._orderPending = true;
    try {
      assertBookOwner(this.journal);
      const visible = reorderedUUIDs(this.pages, source, target, kind, after);
      const stored = this.journal.getFlag(ID, "order");
      const order = mergeVisibleOrder(Array.isArray(stored) ? stored : this.pages.map(p => p.uuid), bookPageUUIDs(this.journal), visible);
      await this.journal.setFlag(ID, "order", order); this.refresh();
    } catch (error) {ui.notifications.warn(error.message);} finally {this._orderPending = false;}
  }

  bindSearch(content) {
    const input = content.querySelector("[data-mkjb-search]");
    input?.addEventListener("input", () => {
      this.searchQuery = input.value; this._searchToken++; clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => void this.searchBook(), 180);
    });
    input?.addEventListener("keydown", event => {
      if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); void this.handleAction("search");}
      if (event.key === "Enter") {event.preventDefault(); content.querySelector("[data-mkjb-search-result]")?.click();}
    });
    if (this.searchOpen) {input?.focus({preventScroll: true}); void this.searchBook();}
  }

  async searchBook() {
    const token = ++this._searchToken, revision = this._revision, viewer = game.user;
    const panel = this.element?.querySelector(".mkjb-search"), results = panel?.querySelector(".mkjb-search-results"), status = panel?.querySelector(".mkjb-search-status");
    if (!results || !this.searchOpen) return;
    const valid = () => token === this._searchToken && revision === this._revision && viewer === game.user && panel.isConnected && this.searchOpen;
    const query = this.searchQuery.trim().slice(0, 200), needle = query.toLocaleLowerCase();
    results.replaceChildren(); status.textContent = query ? "Searching…" : "Search all pages included in this book.";
    if (!query) return;
    const matches = [];
    for (const row of this.pages) {
      if (!valid()) return;
      let text = "";
      try {text = row.page.type === "text" ? searchableText(await this.renderPage(row.page)) : "";} catch { /* Titles remain searchable if an enricher fails. */ }
      if (!valid()) return;
      if (`${row.name}\n${row.journal}\n${text}`.toLocaleLowerCase().includes(needle)) matches.push({...row, excerpt: searchExcerpt(text, query)});
    }
    if (!valid()) return;
    results.innerHTML = searchResultsHTML(matches);
    status.textContent = `${matches.length} ${matches.length === 1 ? "page" : "pages"} found`;
    results.querySelectorAll("[data-mkjb-search-result]").forEach(button => button.addEventListener("click", () => {
      if (!this.resolvePage(button.dataset.mkjbSearchResult)) return;
      this.searchOpen = false; this.tab = "all"; this.selectedUUID = button.dataset.mkjbSearchResult; this.refresh();
    }));
  }

  scheduleReadingPosition() {
    clearTimeout(this._rememberTimer);
    if (this._turnPending || this._closing) return;
    this._rememberTimer = setTimeout(() => void this.rememberPosition(), 400);
  }

  async rememberPosition() {
    const user = game.user;
    if (this._turnPending && !this._closing) return;
    if (this._readerId !== user.id || !this.selectedUUID || (this.journal && !canReadBook(this.journal, user))) return;
    const value = {tab: this.tab, uuid: this.selectedUUID};
    if (!this.sequence.some(row => row.uuid === value.uuid) || JSON.stringify(user.getFlag(ID, "reading")?.[this.bookmarkKey]) === JSON.stringify(value)) return;
    try {await user.setFlag(ID, `reading.${this.bookmarkKey}`, value);} catch (error) {console.warn("MK Journal Book | Reading position was not saved", error);}
  }

  bindDropTarget(shell) {
    shell.addEventListener("dragover", event => {
      event.preventDefault(); event.stopPropagation();
      if (Array.from(event.dataTransfer?.types ?? []).includes("application/x-mkjb-order")) {shell.classList.remove("mkjb-drag-over"); event.dataTransfer.dropEffect = "none"; return;}
      if (!this.canManage || this._dropPending) { if (event.dataTransfer) event.dataTransfer.dropEffect = "none"; return; }
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      shell.classList.add("mkjb-drag-over");
    });
    shell.addEventListener("dragleave", event => {
      if (!shell.contains(event.relatedTarget)) shell.classList.remove("mkjb-drag-over");
    });
    shell.addEventListener("drop", event => {
      event.preventDefault(); event.stopPropagation(); shell.classList.remove("mkjb-drag-over");
      if (!this.canManage || this._dropPending) return;
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if (data?.type === "MKJournalBookOrder") return;
      this._dropPending = true;
      void addDroppedDocument(data, this.journal).then(pages => {
        if (!pages.length) { ui.notifications.info("This journal has no pages to add."); return; }
        this.tab = "all"; this.selectedUUID = pages[0].uuid; this.refresh();
      }).catch(error => {
        console.warn("MK Journal Book | Drop failed", error);
        ui.notifications.warn(error.message || "Could not add this journal to the book.");
      }).finally(() => { this._dropPending = false; });
    });
  }

  async renderPage(page) {
    if (!this.resolvePage(page.uuid)) return "";
    if (page.type === "text") {
      let html = page.text?.content ?? "";
      if (page.text?.format === CONST.JOURNAL_ENTRY_PAGE_FORMATS?.MARKDOWN && page.text?.markdown) {
        const Converter = globalThis.showdown?.Converter;
        html = Converter ? new Converter({tables: true}).makeHtml(page.text.markdown) :
          `<pre class="mkjb-markdown">${e(page.text.markdown)}</pre>`;
      }
      const editor = foundry.applications.ux.TextEditor.implementation;
      const enriched = await editor.enrichHTML(html, {secrets: game.user.isGM, relativeTo: page});
      const template = document.createElement("template");
      template.innerHTML = enriched;
      // Defense in depth: protect even when another module's enricher retains secret blocks.
      if (!game.user.isGM) template.content.querySelectorAll(".secret:not(.revealed)").forEach(el => el.remove());
      template.content.querySelectorAll("script, style, link, object, embed, base, meta").forEach(el => el.remove());
      for (const element of template.content.querySelectorAll("*")) {
        for (const attr of Array.from(element.attributes)) {
          if (/^on/i.test(attr.name) || attr.name === "srcdoc" ||
            (["href", "src", "xlink:href"].includes(attr.name) && !safeMediaURL(attr.value))) element.removeAttribute(attr.name);
        }
      }
      return template.innerHTML || '<p class="mkjb-muted">This page is empty.</p>';
    }
    const src = safeMediaURL(page.src);
    if (page.type === "image" && src) return `<figure><img src="${e(src)}" alt="${e(page.name)}" loading="lazy">${page.image?.caption ? `<figcaption>${e(page.image.caption)}</figcaption>` : ""}</figure>`;
    if (page.type === "video" && src && /\.(webm|mp4|m4v|ogv|ogg)([?#].*)?$/i.test(src))
      return `<video controls preload="metadata" src="${e(src)}" aria-label="${e(page.name)}"></video>`;
    // Native sheets provide PDF controls, YouTube handling, and system-specific page types.
    return `<div class="mkjb-media-card"><span aria-hidden="true">▤</span><h2>${e(page.type === "pdf" ? "PDF document" : page.type === "video" ? "Video page" : "Journal page")}</h2><p>Click the journal name above to view this page with Foundry’s native viewer.</p></div>`;
  }

  async handleAction(action, uuid = this.selectedUUID, noteId) {
    if (action === "close") return this.close();
    if (this._closing || this._opening) return;
    if (action === "search") {this.searchOpen = !this.searchOpen; this.refresh(); return;}
    if (action === "bookmark") return this.editBookmark(uuid);
    if (action === "present") return this.showToPlayers();
    if (action === "appearance") return this.editAppearance();
    if (action === "tag") return this.editTag(uuid);
    if (action === "note") return noteId ? this.editPageNote(uuid, noteId) : this.choosePageNote(uuid);
    if (action === "add-note") return this.editPageNote(uuid, newNoteId());
    if (action === "view-note") {
      const papers = Array.from(this.element?.querySelectorAll("[data-note-id]") ?? []).filter(el => el.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf === uuid);
      if (!this.resolvePage(uuid) || !papers.length) return;
      const index = ((this._viewedNotes.get(uuid) ?? -1) + 1) % papers.length; this._viewedNotes.set(uuid, index);
      this._noteLayout?.cancel(); papers[index].style.zIndex = String(++this._noteFront);
      papers[index].querySelector(".mkjb-note-text")?.focus({preventScroll: true});
      return;
    }
    if (action === "index") { this.tab = "all"; this.selectedUUID = INDEX_UUID; this.refresh(); return; }
    if (action === "remove") {
      if (this.canManage && this.resolvePage(uuid)) await changeMembership(uuid, false, this.journal);
      return;
    }
    if (action === "refresh") return this.refresh();
    if (action === "original") {
      const page = this.resolvePage(uuid);
      if (page) await page.parent.sheet.render({force: true, pageId: page.id});
      return;
    }
    if (["previous", "next"].includes(action)) return this.turnPage(action);
  }

  async editTag(uuid) {
    if (!this.canManage || this._tagPending) return;
    const row = this.pages.find(page => page.uuid === uuid);
    if (!row) return;
    const viewer = game.user;
    const listId = `${this.id ?? this.options.id}-tag-options`;
    this._tagPending = true;
    try {
      await foundry.applications.api.DialogV2.prompt({window: {title: "Page Tag"}, rejectClose: false,
        content: `<p>Tag for <strong>${e(row.name)}</strong> in this book.</p>
          <div class="form-group"><label>Tag</label><div class="form-fields"><input type="text" name="pageTag" value="${e(row.tag)}" maxlength="${TAG_MAX_LENGTH}" list="${e(listId)}" autofocus aria-label="Page tag" placeholder="e.g. Quests"></div></div>
          <datalist id="${e(listId)}">${tagTabs(this.pages).filter(tag => tag.key.startsWith("tag:")).map(tag => `<option value="${e(tag.label)}"></option>`).join("")}</datalist>
          <p>Choose an existing tag or type a new one. Leave empty to remove it. Each page has one tag; matching tags share a side tab.</p>`,
        ok: {label: "Save", callback: async (_event, button) => {
          if (viewer !== game.user || !this.canManage || !this.resolvePage(uuid)) throw new Error("You can no longer tag this page.");
          await setPageTag(uuid, button.form.elements.namedItem("pageTag").value, this.journal);
          this.refresh();
        }}
      });
    } finally {this._tagPending = false;}
  }

  async choosePageNote(uuid) {
    const row = this.pages.find(page => page.uuid === uuid);
    if (!this.canManage || this._notePending || !row) return;
    if (row.notes.length < 2) return this.editPageNote(uuid);
    const viewer = game.user;
    this._notePending = true;
    let id;
    try {
      id = await foundry.applications.api.DialogV2.prompt({window: {title: "Choose Page Note"}, rejectClose: false,
        content: `<div class="form-group"><label>Note to edit</label><select name="noteId" aria-label="Note to edit">${row.notes.map(note => `<option value="${e(note.id)}">${e(note.title || note.text.slice(0, 60))}</option>`).join("")}</select></div>`,
        ok: {label: "Edit note", callback: (_event, button) => button.form.elements.namedItem("noteId").value}
      });
    } finally {this._notePending = false;}
    if (viewer === game.user && typeof id === "string") return this.editPageNote(uuid, id);
  }

  async editPageNote(uuid, noteId) {
    if (!this.canManage || this._notePending) return;
    const row = this.pages.find(page => page.uuid === uuid);
    if (!row) return;
    this._noteLayout?.cancel();
    noteId ??= row.notes[0]?.id ?? "primary";
    const note = getNote(row.page, this.journal, noteId);
    const paper = Array.from(this.element?.querySelectorAll("[data-note-id]") ?? []).find(el => el.dataset.noteId === noteId && el.closest("[data-mkjb-leaf]")?.dataset.mkjbLeaf === uuid);
    if (paper) paper.style.zIndex = String(++this._noteFront);
    const viewer = game.user, original = JSON.stringify(note);
    this._notePending = true;
    try {
      await foundry.applications.api.DialogV2.prompt({window: {title: note ? "Edit Page Note" : "Add Page Note"}, rejectClose: false,
        render: (_event, dialog) => {
          const slider = dialog.element.querySelector('[name="noteRotation"]');
          slider?.addEventListener("input", () => {this._noteLayout?.preview(uuid, noteId, Number(slider.value)); dialog.element.querySelector("[data-note-angle]").textContent = `${slider.value}°`;});
        },
        content: `<p>A note for <strong>${e(row.name)}</strong>. Everyone who can read this page in the book can see it.</p>
          <div class="form-group"><label for="mkjb-note-style">Note style</label><div class="form-fields"><select id="mkjb-note-style" name="noteStyle" aria-label="Note style">${noteStyleOptions(note?.style)}</select></div></div>
          <div class="form-group"><label for="mkjb-note-title">Title (optional)</label><div class="form-fields"><input type="text" id="mkjb-note-title" name="noteTitle" maxlength="${NOTE_TITLE_MAX_LENGTH}" value="${e(note?.title ?? "")}" aria-label="Note title" placeholder="Leave blank for no title"></div></div>
          <div class="form-group"><label for="mkjb-note-rotation">Tilt (−${NOTE_MAX_TILT}° to +${NOTE_MAX_TILT}°)</label><div class="form-fields"><input type="range" id="mkjb-note-rotation" name="noteRotation" min="-${NOTE_MAX_TILT}" max="${NOTE_MAX_TILT}" step="0.1" value="${noteRotation(note)}" aria-label="Note tilt"><output data-note-angle>${noteRotation(note)}°</output></div></div>
          <div class="form-group stacked"><label for="mkjb-note-text">Note</label><textarea id="mkjb-note-text" name="pageNote" rows="8" maxlength="${NOTE_MAX_LENGTH}" autofocus aria-label="Page note" placeholder="Write a reminder, clue, or thought…">${e(note?.text ?? "")}</textarea></div>
          <p>Plain text, up to ${NOTE_MAX_LENGTH} characters. Leave empty to remove the note.</p>
          <p>Drag the cross-arrow handle anywhere on this page, including its title and margins, or focus the handle and use the arrow keys. Hover over the note text to fold it up and read underneath.</p>
          ${note ? '<div class="form-group"><label>Reset position, size and tilt</label><input type="checkbox" name="resetNoteLayout" aria-label="Reset position, size and tilt"></div>' : ""}
          ${note ? '<div class="form-group"><label>Remove this note</label><input type="checkbox" name="removeNote" aria-label="Remove this note"></div>' : ""}`,
        ok: {label: "Save", callback: async (_event, button) => {
          if (viewer !== game.user || !this.canManage || !this.resolvePage(uuid)) throw new Error("You can no longer edit this page note.");
          const form = button.form.elements;
          const reset = form.namedItem("resetNoteLayout")?.checked, tilt = Number(form.namedItem("noteRotation").value);
          const rotation = reset || (note?.rotation == null && tilt === noteRotation(note)) ? null : tilt;
          await setPageNote(uuid, form.namedItem("removeNote")?.checked ? "" : form.namedItem("pageNote").value, this.journal, {noteId, expected: original, style: form.namedItem("noteStyle").value, title: form.namedItem("noteTitle").value, rotation, position: reset ? null : note ? undefined : row.notes.length ? {x: Math.max(0, 1 - row.notes.length * .18), y: Math.min(.8, .3 + row.notes.length * .12)} : null, size: reset ? null : undefined});
          this.refresh();
        }}
      });
    } finally {
      this._notePending = false;
      const page = this.resolvePage(uuid);
      if (page && this.rendered && !this._closing) this._noteLayout?.preview(uuid, noteId, noteRotation(getNote(page, this.journal, noteId)));
    }
  }

  async showToPlayers() {
    if (!game.user.isGM || !this.journal || this._presentationPending) return;
    const viewer = game.user, uuid = this.selectedUUID, tab = this.tab;
    const users = Array.from(game.users).filter(user => !user.isGM && user.active !== false);
    this._presentationPending = true;
    try {
      await foundry.applications.api.DialogV2.prompt({window: {title: "Show Book Page to Players"}, rejectClose: false,
        content: `<p>Open this spread once for selected players. They can continue browsing independently.</p>
          ${users.length ? users.map(user => `<div class="form-group"><label>${e(user.name)}${canReceivePresentation(this.journal, user, uuid) ? "" : " — needs access to this book/page"}</label><input type="checkbox" name="recipient" value="${e(user.id)}" ${canReceivePresentation(this.journal, user, uuid) ? "checked" : "disabled"}></div>`).join("") : "<p>No players are connected.</p>"}`,
        ok: {label: "Show page", callback: async (_event, button) => {
          if (viewer !== game.user || !game.user.isGM) throw new Error("Only a GM can show this page.");
          const ids = Array.from(button.form.querySelectorAll('[name="recipient"]:checked'), input => input.value);
          const count = await presentPage(this.journal, uuid, tab, ids);
          ui.notifications.info(`Book page shown to ${count} ${count === 1 ? "player" : "players"}.`);
        }}
      });
    } finally {this._presentationPending = false;}
  }

  async editAppearance() {
    if (!this.canManage || this._appearancePending) return;
    const viewer = game.user;
    this._appearancePending = true;
    try {
      await foundry.applications.api.DialogV2.prompt({window: {title: "Book Style and Cover"}, rejectClose: false,
        render: (_event, dialog) => {
          const form = dialog.element.querySelector("form"), preview = dialog.element.querySelector(".mkjb-cover-preview");
          const update = () => {
            const fields = form.elements, style = resolveBookPreset(fields.namedItem("bookStyle").value, game.settings.get(ID, "bookStyle"));
            preview.dataset.mkjbStyle = style;
            fillCover(preview, coverDetails({title: fields.namedItem("coverTitle").value, subtitle: fields.namedItem("coverSubtitle").value, image: fields.namedItem("coverImage").value, emblem: fields.namedItem("coverEmblem").value}, this.journal?.name ?? game.settings.get(ID, "bookTitle"), style));
          };
          form.addEventListener("input", update); form.addEventListener("change", update); update();
        },
        content: `<div class="form-group"><label>Style preset</label><div class="form-fields"><select name="bookStyle" aria-label="Book style">${presetOptions(this.journal?.getFlag(ID, "style") ?? (this.journal ? "default" : this.preset), {inherit: Boolean(this.journal)})}</select></div></div>
          <div class="form-group"><label>Cover title</label><input type="text" name="coverTitle" maxlength="120" value="${e(normalizeCover(this.journal?.getFlag(ID, "cover") ?? game.settings.get(ID, "legacyCover")).title)}" placeholder="Use the journal name"></div>
          <div class="form-group"><label>Subtitle</label><input type="text" name="coverSubtitle" maxlength="160" value="${e(this.cover.subtitle)}"></div>
          <div class="form-group"><label>Emblem image</label><file-picker name="coverEmblem" type="image" value="${e(this.cover.emblem)}"></file-picker></div>
          <div class="form-group"><label>Custom cover image</label><file-picker name="coverImage" type="image" value="${e(normalizeCover(this.journal?.getFlag(ID, "cover") ?? game.settings.get(ID, "legacyCover")).image)}"></file-picker></div>
          <p>Leave image fields empty to use the preset artwork. The title does not rename the source journal.</p>
          <div class="mkjb-cover-preview" aria-label="Cover preview"></div>
          <ul>${Object.values(BOOK_PRESETS).map(p => `<li><strong>${e(p.name)}</strong>: ${e(p.description)}</li>`).join("")}</ul><p>The preset sets the book artwork, paper, typefaces and text sizes for everyone reading this book.</p>`,
        ok: {label: "Apply", callback: async (_event, button) => {
          if (viewer !== game.user || !this.canManage) throw new Error("Only this book's owners and GMs can change its style.");
          const style = button.form.elements.namedItem("bookStyle").value;
          if (style !== "default" && !isBookPreset(style)) throw new Error("Choose a valid book style.");
          const fields = button.form.elements;
          const cover = normalizeCover({title: fields.namedItem("coverTitle").value, subtitle: fields.namedItem("coverSubtitle").value, emblem: fields.namedItem("coverEmblem").value, image: fields.namedItem("coverImage").value});
          for (const key of ["coverImage", "coverEmblem"]) if (fields.namedItem(key).value.trim() && !safeMediaURL(fields.namedItem(key).value)) throw new Error("Choose a local image or an HTTP(S) image URL.");
          if (this.journal) {assertBookOwner(this.journal); await this.journal.update({[`flags.${ID}.style`]: style === "default" ? null : style, [`flags.${ID}.cover`]: cover});}
          else {await game.settings.set(ID, "bookStyle", resolveBookPreset(style)); await game.settings.set(ID, "legacyCover", cover);}
          this.refresh();
        }}
      });
    } finally {this._appearancePending = false;}
  }

  async editBookmark(uuid) {
    if (this._bookmarkPending) return;
    const owner = game.user;
    const target = () => uuid === INDEX_UUID ? {name: "Journal Index"} : this.resolvePage(uuid);
    const canAccess = () => owner === game.user && (!this.journal || (game.journal.get(this.journal.id) && canReadBook(this.journal, owner))) && target();
    if (!canAccess()) return;
    const key = this.bookmarkKey;
    const existing = savedBookmarks(owner, key).find(mark => mark.uuid === uuid);
    const color = existing?.color ?? RIBBON_COLORS[savedBookmarks(owner, key).length % RIBBON_COLORS.length];
    this._bookmarkPending = true;
    try {
      await foundry.applications.api.DialogV2.prompt({
        window: {title: existing ? "Edit Bookmark" : "Add Bookmark"}, rejectClose: false,
        content: `<p>Your bookmark for <strong>${e(target().name)}</strong>.</p>
          <div class="form-group"><label>Label</label><div class="form-fields"><input type="text" name="bookmarkLabel" value="${e(existing?.label || target().name)}" maxlength="60" required autofocus aria-label="Bookmark label"></div></div>
          <div class="form-group"><label>Ribbon color</label><div class="form-fields"><input type="color" name="bookmarkColor" value="${color}" aria-label="Ribbon color"></div></div>
          ${existing ? '<div class="form-group"><label>Remove this bookmark</label><div class="form-fields"><input type="checkbox" name="removeBookmark" aria-label="Remove this bookmark"></div></div>' : ''}`,
        ok: {label: "Save", callback: async (_event, button) => {
          if (!canAccess()) throw new Error("This bookmark page is no longer available to you.");
          const form = button.form.elements;
          const mark = {uuid, label: form.namedItem("bookmarkLabel").value.trim() || target().name, color: ribbonColor(form.namedItem("bookmarkColor").value)};
          const marks = updatedBookmarks(savedBookmarks(owner, key), mark, Boolean(form.namedItem("removeBookmark")?.checked));
          await owner.setFlag(ID, `bookmarks.${key}`, marks);
          this.refresh();
        }}
      });
    } finally { this._bookmarkPending = false; }
  }

  cancelBookOpen({stopSound = true} = {}) {
    if (stopSound) this._sounds.stop();
    this._openToken++;
    this._openAnimation?.cancel(); this._openAnimation = null;
    this._opening = false; this._openPromise = null;
    this.element?.querySelector(".mkjb-shell")?.classList.remove("mkjb-opening-pending", "mkjb-is-opening");
    if (this.element && !this._closing) {this.element.inert = false; this.element.removeAttribute("aria-busy");}
  }

  cancelPageTurn() {
    this._sounds.stop();
    this._turnToken++;
    this._turnAnimation?.cancel(); this._turnAnimation = null;
    this._turnPreparation?.remove(); this._turnPreparation = null; this._turnPending = false;
    this.element?.removeAttribute("aria-busy");
  }

  async turnPage(direction) {
    if (!this.rendered || this._turnPending || this._closing || this._opening) return;
    this._noteLayout?.cancel();
    const pages = this.sequence;
    const index = Math.floor(Math.max(0, pages.findIndex(p => p.uuid === this.selectedUUID)) / 2) * 2;
    const next = pages[index + (direction === "previous" ? -2 : 2)];
    if (!next) return;
    const duration = flipDuration(game.settings.get(ID, "flipDuration"));
    if (duration === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.selectedUUID = next.uuid; this.refresh(); this._sounds.play("flip"); return;
    }
    const before = {left: snapshotLeaf(this.element?.querySelector(".mkjb-left")), right: snapshotLeaf(this.element?.querySelector(".mkjb-right"))};
    if (!before.left || !before.right) {this.selectedUUID = next.uuid; this.refresh(); this._sounds.play("flip"); return;}
    const token = ++this._turnToken;
    this._turnPending = true; this.element.setAttribute("aria-busy", "true");
    clearTimeout(this._refreshTimer); clearTimeout(this._rememberTimer);
    const preparation = holdSpread(before);
    this._turnPreparation = preparation;
    preparation.mount(this.element.querySelector(".mkjb-book"));
    try {
      this.selectedUUID = next.uuid;
      await this.render({force: true});
      if (token !== this._turnToken || !this.rendered) return;
      this._turnAnimation = animateSpread(this.element.querySelector(".mkjb-book"), before, direction, duration);
      preparation.remove(); this._turnPreparation = null;
      this._sounds.play("flip");
      await this._turnAnimation.finished;
    } catch (error) {
      console.warn("MK Journal Book | Page animation skipped", error);
    } finally {
      preparation.remove();
      if (token === this._turnToken) {
        this._turnAnimation = null; this._turnPreparation = null; this._turnPending = false; this.element?.removeAttribute("aria-busy");
        if (this.rendered && !this._closing) this.scheduleReadingPosition();
      }
    }
  }

  bindPositionHandle(handle, resize) {
    if (!handle) return;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); this.bringToFront();
      const rect = this.element.getBoundingClientRect();
      const start = {x: event.clientX, y: event.clientY};
      handle.setPointerCapture(event.pointerId);
      const move = ev => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (resize) this.setPosition({width: Math.max(640, rect.width + dx), height: Math.max(440, rect.height + dy)});
        else this.setPosition({left: Math.max(0, Math.min(window.innerWidth - 80, rect.left + dx)), top: Math.max(0, Math.min(window.innerHeight - 60, rect.top + dy))});
      };
      const stop = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
        handle.removeEventListener("lostpointercapture", stop);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
      handle.addEventListener("lostpointercapture", stop);
    });
  }

  refresh({invalidate = false} = {}) {
    if (invalidate) {this._imageViewer?.close(); this._imageViewer = null;}
    this._searchToken++; clearTimeout(this._searchTimer);
    this._noteLayout?.destroy(); this._noteLayout = null;
    if (this._closing) {
      if (invalidate) {this._sounds.stop(); this._closeAnimation?.cancel(); this.element?.querySelector(".mkjb-shell")?.replaceChildren();}
      return;
    }
    if (this._opening) this.cancelBookOpen();
    this.cancelPageTurn();
    this._revision++;
    // Clear rendered data synchronously when permissions/content change. An in-flight
    // enrichment cannot restore old HTML because _replaceHTML checks the revision.
    if (invalidate) this.element?.querySelector(".mkjb-shell")?.replaceChildren();
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      if (this.rendered) void this.render({force: true}).catch(error => console.error("MK Journal Book", error));
    }, 40);
  }

  async close(options = {}) {
    if (this._closePromise) {
      if (options.animate === false) this._closeAnimation?.cancel();
      if (options.sound === false) this._sounds.stop();
      return this._closePromise;
    }
    this._closing = true;
    this._imageViewer?.close(); this._imageViewer = null;
    clearTimeout(this._rememberTimer); this._searchToken++; clearTimeout(this._searchTimer);
    const remembered = this.rememberPosition();
    this._noteLayout?.destroy(); this._noteLayout = null;
    const wasOpening = this._opening;
    this.cancelBookOpen();
    this.cancelPageTurn();
    clearTimeout(this._refreshTimer); this._revision++;
    const element = this.element, shell = element?.querySelector(".mkjb-shell");
    if (element) {element.inert = true; element.setAttribute("aria-busy", "true");}
    this._closePromise = (async () => {
      try {
        const duration = flipDuration(game.settings.get(ID, "flipDuration"));
        const readable = !this.journal || (game.journal.get(this.journal.id) && canReadBook(this.journal, game.user));
        const container = shell?.querySelector(".mkjb-book");
        if (options.sound !== false && this.rendered && readable && container) this._sounds.play("close");
        if (!wasOpening && options.animate !== false && this.rendered && readable && container && duration > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          this._closeAnimation = animateBookClose(container, {duration, title: this.journal?.name ?? game.settings.get(ID, "bookTitle"), cover: this.cover});
          await this._closeAnimation?.finished;
        }
      } catch (error) {console.warn("MK Journal Book | Closing animation skipped", error);}
      try {
        await remembered;
        this.selectedUUID = null; this.tab = "all"; this.searchOpen = false; openApps.delete(this);
        // The custom animation has finished; avoid Foundry's second window animation.
        return await super.close({...options, animate: false});
      } finally {
        this._closeAnimation?.cancel(); this._closeAnimation = null;
        shell?.classList.remove("mkjb-is-closing");
        if (element) {element.inert = false; element.removeAttribute("aria-busy");}
        this._closing = false; this._closePromise = null;
      }
    })();
    return this._closePromise;
  }
};

export class MKJournalBook extends BookApplication(ApplicationV2) {}
export class MKJournalBookSheet extends BookApplication(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {tag: "div", viewPermission: 2, editPermission: 3};
  constructor(options = {}, ...args) {
    // Foundry instantiates DocumentSheetV2 with {document}; give each journal its own window.
    super({...options, id: `${ID}-${options.document.id}`}, ...args);
  }
  get journal() { return this.document; }
}

/** One document update publishes membership and access atomically. */
export async function changeMembership(pageUUID, add, journal = null) {
  if (journal) {
    assertBookOwner(journal);
    if (add) return (await addDroppedDocument({type: "JournalEntryPage", uuid: pageUUID}, journal))[0];
    await journal.setFlag(ID, "pages", bookPageUUIDs(journal).filter(uuid => uuid !== pageUUID));
    return;
  }
  if (!game.user.isGM) throw new Error("Only a GM can add or remove book pages.");
  const page = await fromUuid(pageUUID);
  if (page?.documentName !== "JournalEntryPage" || page.inCompendium) throw new Error("Select a world journal page.");
  const changes = {[`flags.${ID}.included`]: Boolean(add)};
  if (add) changes.ownership = sharedOwnership(page, game.users);
  await page.update(changes);
  return page;
}

/** A dropped journal publishes its current pages only; later pages stay unselected. */
export async function addDroppedDocument(data, journal = null) {
  if (journal) assertBookOwner(journal);
  if (!journal && !game.user.isGM) throw new Error("Only a GM can add journal pages.");
  if (!data || !["JournalEntry", "JournalEntryPage"].includes(data.type))
    throw new Error("Drop a journal or an individual journal page from Foundry.");
  let doc;
  if (typeof data.uuid === "string") doc = await fromUuid(data.uuid);
  else if (data.type === "JournalEntry" && typeof data.id === "string") doc = game.journal.get(data.id);
  if (!doc || !["JournalEntry", "JournalEntryPage"].includes(doc.documentName))
    throw new Error("The dropped journal or page could not be found.");
  if (doc.inCompendium) throw new Error("Import the journal into your world before dropping it into the book.");
  if (isBook(doc)) throw new Error("Drop an ordinary journal or one of its pages. A book cannot contain another book.");
  if (journal) {
    const pages = doc.documentName === "JournalEntryPage" ? [doc] : Array.from(doc.pages).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    if (!pages.length) return [];
    // Owners curate already-shared content. Only GMs publish source permissions.
    if (!game.user.isGM && pages.some(page => !canReadPage(page, game.user) || !sharedWithPlayers(page, game.users)))
      throw new Error("Ask a GM to share these pages with all players first, then drop them into your book.");
    if (game.user.isGM) {
      if (doc.documentName === "JournalEntryPage") await doc.update({ownership: sharedOwnership(doc, game.users)});
      else await doc.updateEmbeddedDocuments("JournalEntryPage", pages.map(page => ({_id: page.id, ownership: sharedOwnership(page, game.users)})));
    }
    assertBookOwner(journal);
    const selected = bookPageUUIDs(journal);
    const changes = {[`flags.${ID}.pages`]: [...new Set([...selected, ...pages.map(page => page.uuid)])]};
    // New additions to older books also start without a tag. Retained tags survive removal/re-addition.
    for (const page of pages) {
      const key = page.uuid.replaceAll(".", "~");
      if (!selected.includes(page.uuid) && !Object.hasOwn(journal.getFlag(ID, "tags") ?? {}, key)) changes[`flags.${ID}.tags.${key}`] = "";
    }
    await journal.update(changes);
    return pages;
  }
  if (doc.documentName === "JournalEntryPage") return [await changeMembership(doc.uuid, true)];
  const pages = Array.from(doc.pages).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  if (!pages.length) return [];
  await doc.updateEmbeddedDocuments("JournalEntryPage", pages.map(page => ({
    _id: page.id, [`flags.${ID}.included`]: true, ownership: sharedOwnership(page, game.users)
  })));
  return pages;
}

function assertBookOwner(journal) {
  if (!game.journal.get(journal?.id) || journal.inCompendium || !canManageBook(journal, game.user))
    throw new Error("Only this book's owners and GMs can change its contents.");
}

export async function setPageTag(pageUUID, value, journal = null) {
  if (typeof value !== "string") throw new Error("A page tag must be text.");
  const page = await fromUuid(pageUUID);
  if (page?.documentName !== "JournalEntryPage" || page.inCompendium) throw new Error("Select a world journal page.");
  // Resolve an existing spelling so case-only variants do not create duplicate tabs.
  const tag = normalizeTag(value);
  const canonical = collectPages(game.journal, game.user, journal).find(row => tag && tagKey(row.tag) === tagKey(tag))?.tag ?? tag;
  if (journal) {
    assertBookOwner(journal);
    if (!bookPageUUIDs(journal).includes(pageUUID) || !canReadPage(page, game.user)) throw new Error("The page is no longer available in this book.");
    // UUIDs contain periods, so use a field-safe key to avoid Foundry dot expansion.
    const key = pageUUID.replaceAll(".", "~");
    return journal.update({[`flags.${ID}.tags.${key}`]: canonical});
  }
  if (!game.user.isGM) throw new Error("Only a GM can tag legacy book pages.");
  if (!collectPages(game.journal, game.user).some(row => row.uuid === pageUUID)) throw new Error("The page is not in the legacy book.");
  return page.setFlag(ID, "tag", canonical);
}

/** Persist notes alongside this book's page tags; source journal content is untouched. */
export async function setPageNote(pageUUID, value, journal = null, {expected, style, title, position, rotation, positionSpace, size, noteId = "primary"} = {}) {
  const viewer = game.user;
  const page = await fromUuid(pageUUID);
  if (viewer !== game.user) throw new Error("The active user changed. Reopen the note editor.");
  if (page?.documentName !== "JournalEntryPage" || page.inCompendium) throw new Error("Select a world journal page.");
  if (journal) {
    assertBookOwner(journal);
    if (!bookPageUUIDs(journal).includes(pageUUID) || !canReadPage(page, viewer)) throw new Error("The page is no longer available in this book.");
  } else {
    if (!viewer.isGM) throw new Error("Only a GM can edit legacy book notes.");
    if (!collectPages(game.journal, viewer).some(row => row.uuid === pageUUID)) throw new Error("The page is not in the legacy book.");
  }
  if (!validNoteId(noteId)) throw new Error("Choose a valid note.");
  const current = getNote(page, journal, noteId);
  if (expected !== undefined && JSON.stringify(current) !== expected)
    throw new Error("This note changed while you were editing. Cancel and reopen it to see the latest version.");
  const note = makePageNote(value, viewer, Date.now(), style === undefined ? current?.style ?? "parchment" : style, title === undefined ? current?.title ?? "" : title,
    {size: size === undefined ? current?.size ?? null : size, position: position === undefined ? current?.position ?? null : position, rotation: rotation === undefined ? current?.rotation ?? null : rotation,
      positionSpace: positionSpace ?? (position === undefined ? current?.positionSpace ?? "page" : "page")});
  if (noteId === "primary") return journal ? journal.update({[`flags.${ID}.notes.${noteKey(pageUUID)}`]: note}) : page.setFlag(ID, "note", note);
  return journal ? journal.update({[`flags.${ID}.extraNotes.${noteKey(pageUUID)}.${noteId}`]: note}) : page.setFlag(ID, `extraNotes.${noteId}`, note);
}

/** Compatibility for older macros; organization now uses tags. */
export async function setPageCategory(pageUUID, category, journal = null) {
  if (category !== "auto" && !CATEGORIES.includes(category)) throw new Error("Unknown book category.");
  return setPageTag(pageUUID, category === "auto" ? "" : LABELS[category], journal);
}

let book;
export async function openBook({pageUUID, tab, tag, bookUUID, legacy = false} = {}) {
  let app;
  if (bookUUID) {
    const journal = await fromUuid(bookUUID);
    if (!canReadBook(journal, game.user)) throw new Error("You do not have access to this book.");
    app = journal.sheet;
    if (!(app instanceof MKJournalBookSheet)) throw new Error("Select MK Journal Book in this journal's sheet configuration.");
  } else if (legacy) app = book ??= new MKJournalBook();
  else return chooseBook();
  if (app._closePromise) await app._closePromise;
  if (app._opening && (pageUUID || tab || tag)) await app._openPromise;
  if (pageUUID || tab || tag) {app.cancelPageTurn(); app._revision++; app.searchOpen = false;}

  const targetTab = typeof tag === "string" ? tagKey(tag) : CATEGORIES.includes(tab) ? tagKey(LABELS[tab]) : tab;
  if (tagTabs(app.pages).some(item => item.key === targetTab)) {app.tab = targetTab; if (!pageUUID) app.selectedUUID = app.sequence[0]?.uuid ?? INDEX_UUID;}
  if (pageUUID) { app.selectedUUID = pageUUID; app.tab = tagTabs(app.pages).some(item => item.key === targetTab) ? targetTab : "all"; }
  await app.render({force: true}); if (app.rendered && !app._closing) app.bringToFront(); return app;
}

async function chooseBook() {
  const books = Array.from(game.journal).filter(j => canReadBook(j, game.user));
  const hasLegacy = collectPages(game.journal, game.user).length > 0;
  if (books.length === 1 && !hasLegacy) return openBook({bookUUID: books[0].uuid});
  if (!books.length && hasLegacy) return openBook({legacy: true});
  if (!books.length && !hasLegacy) {
    if (CONFIG.JournalEntry.documentClass.canUserCreate(game.user))
      return CONFIG.JournalEntry.documentClass.createDialog({flags: {[ID]: {book: true}}});
    ui.notifications.info("No journal books have been shared with you yet."); return null;
  }
  const selection = await foundry.applications.api.DialogV2.prompt({window: {title: "Open Journal Book"}, rejectClose: false,
    content: `<div class="form-group"><label>Book</label><select name="book">${books.map(j => `<option value="${e(j.uuid)}">${e(j.name)}</option>`).join("")}${hasLegacy ? '<option value="legacy">Legacy campaign book</option>' : ""}</select></div>`,
    ok: {label: "Open", callback: (_event, button) => button.form.elements.namedItem("book").value}
  });
  if (selection) return openBook(selection === "legacy" ? {legacy: true} : {bookUUID: selection});
  return null;
}

Hooks.once("init", () => {
  registerJournalIntegration(MKJournalBookSheet);
  registerSoundSettings();
  game.settings.register(ID, "legacyCover", {scope: "world", config: false, type: Object, default: {}});
  game.settings.register(ID, "pagePresentation", {scope: "world", config: false, type: Object, default: {}, onChange: value => {void receivePresentation(value, openBook).catch(error => console.warn("MK Journal Book | Could not show page", error));}});
  for (const [key, name, hint, value, max] of [
    ["noteHoverDelay", "Note hover delay (ms)", "Wait before folding a note to reveal the page underneath. Pin a note to keep it open.", 900, 5000],
    ["noteFoldDuration", "Note folding duration (ms)", "Speed of folding and unfolding notes. Set to 0 for an instant change. Reduced motion is respected.", 1200, 3000]
  ]) game.settings.register(ID, key, {name, hint, scope: "client", config: true, type: new foundry.data.fields.NumberField({nullable: false, integer: true, min: 0, max, step: 100}), default: value, onChange: () => {for (const app of openApps) app.refresh();}});
  game.settings.register(ID, "alwaysStartAtIndex", {name: "Always open at the index", hint: "When disabled, each reader returns to their last spread in each book.", scope: "client", config: true, type: Boolean, default: false});
  game.settings.register(ID, "bookStyle", {
    name: "Default book style", hint: "Artwork and typography for books using the module default. Owners can choose a different preset inside each book.",
    scope: "world", config: true, type: String, choices: Object.fromEntries(Object.entries(BOOK_PRESETS).map(([key, value]) => [key, value.name])), default: "classic",
    onChange: () => {for (const app of openApps) app.refresh();}
  });
  game.settings.register(ID, "flipDuration", {
    name: "Page flip duration (ms)", hint: "Duration of a page turn or the opening/closing fold in milliseconds. Set to 0 for instant turns, opening and closing. Reduce motion is always respected.",
    scope: "world", config: true,
    type: new foundry.data.fields.NumberField({nullable: false, integer: true, min: FLIP_DURATION.min, max: FLIP_DURATION.max, step: FLIP_DURATION.step}),
    default: FLIP_DURATION.default
  });
  game.settings.register(ID, "bookTitle", {name: "Legacy book title", hint: "For the previous campaign book. New books use their journal name.", scope: "world", config: true, type: String, default: "The Campaign Chronicle", onChange: () => book?.refresh()});
  game.keybindings.register(ID, "open", {name: "Open Journal Book", hint: "Choose one of your journal books.", editable: [{key: "KeyJ", modifiers: ["Alt"]}], onDown: () => { void openBook(); return true; }});
});
Hooks.once("ready", () => {
  const resolveBook = async uuid => {
    if (!uuid) return null;
    const journal = await fromUuid(uuid); assertBookOwner(journal); return journal;
  };
  game.modules.get(ID).api = {open: openBook,
    create: data => CONFIG.JournalEntry.documentClass.createDialog({...data, flags: {...data?.flags, [ID]: {book: true}}}),
    addJournal: async (uuid, bookUUID) => addDroppedDocument({type: "JournalEntry", uuid}, await resolveBook(bookUUID)),
    addPage: async (uuid, bookUUID) => changeMembership(uuid, true, await resolveBook(bookUUID)),
    removePage: async (uuid, bookUUID) => changeMembership(uuid, false, await resolveBook(bookUUID)),
    setCategory: async (uuid, category, bookUUID) => setPageCategory(uuid, category, await resolveBook(bookUUID)),
    setTag: async (uuid, tag, bookUUID) => setPageTag(uuid, tag, await resolveBook(bookUUID)),
    setNote: async (uuid, text, bookUUID, options = {}) => setPageNote(uuid, text, await resolveBook(bookUUID), options),
    addNote: async (uuid, text, bookUUID, options = {}) => {const noteId = newNoteId(); await setPageNote(uuid, text, await resolveBook(bookUUID), {...options, noteId}); return noteId;},
    showPage: async (bookUUID, pageUUID = INDEX_UUID, users = []) => presentPage(await resolveBook(bookUUID), pageUUID, "all", users),
    get app() { return book; }
  };
});
for (const kind of ["JournalEntry", "JournalEntryPage", "Folder", "User"]) {
  for (const action of ["create", "update", "delete"]) {
    Hooks.on(`${action}${kind}`, (_document, changes) => {
      // Personal reading state must not interrupt animations or trigger another render/save.
      if (kind === "User" && isReadingPositionUpdate(changes)) return;
      for (const app of openApps) {
        if (app.journal && (!game.journal.get(app.journal.id) || !canReadBook(app.journal, game.user))) {
          app.element?.querySelector(".mkjb-shell")?.replaceChildren(); void app.close({animate: false, sound: false});
        } else app.refresh({invalidate: true});
      }
    });
  }
}
