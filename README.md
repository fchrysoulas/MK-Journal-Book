# MK Journal Book

Version 0.14.1 · Targets Foundry VTT 13–14 · System independent · No required modules

Create named journal books with their own owners and contents. Each opens as a floating, illustrated book with an **All** tab and custom side tabs generated from its page tags. The first page is a compact journal index with clickable lines for each included page. Bold Previous and Next controls sit above the lower page edge and animate the paper turning across the spine.

## Install or update

1. In Foundry's **Setup → Add-on Modules**, click **Install Module**.
2. Paste this URL into **Manifest URL** and click **Install**:

   ```text
   https://github.com/fchrysoulas/MK-Journal-Book/releases/latest/download/module.json
   ```

3. Open your world and enable **MK Journal Book** in **Manage Modules**.

Use Foundry's **Check for Updates** to install future releases.

For manual installation, download `mk-journal-book.zip` from the [latest release](https://github.com/fchrysoulas/MK-Journal-Book/releases/latest) and extract its contents into Foundry's user data `Data/modules/mk-journal-book/`, replacing the previous files. Confirm the manifest is at `Data/modules/mk-journal-book/module.json` without another nested directory, then restart Foundry and reload connected clients. Hosted services need their supported custom-module installation or upload workflow.

## Create a book and assign an owner

1. In the Journal sidebar, click **Create Journal Entry**.
2. Enter the book's name and select **Journal type → MK Journal Book**.
3. Choose a folder, a **Book style**, and a **Book owner** (or leave **GM only**).
4. Click **Create New Journal Entry**. The empty book opens immediately.

The book appears as its own journal entry in the sidebar. Open it there whenever needed. You can create several books; their contents, page tags and floating windows are independent. Rename the journal entry to rename the book. The appearance dialog can set a separate cover title.

The selected player receives **Owner** access. Other players start with **Observer** access so they can read the book. GMs always retain access. To change or restrict access later, right-click the book's journal entry and choose **Configure Ownership**. Ownership refers to Foundry users, not character actors.

Players with Foundry's permission to create journals can also create books. Their books assign them as Owner. The module does not grant journal-creation permission to players who lack it.

Choosing **Journal Entry** in the same dialog creates an ordinary journal with its normal sheet. Book-owner selection applies only to MK Journal Book.

## Book style presets

Choose a preset in **Create Journal Entry → Book style**, or use the **Book style** palette button at the top-right of an existing book. Owners and GMs can change a book's appearance; all readers see the saved preset. Each book can have a different style.

| Preset | Book artwork and paper | Default body type |
| --- | --- | --- |
| Classic Parchment | Brown leather and warm, aged parchment | Georgia serif, 16 px |
| Gothic Grimoire | Oxblood leather, gold margin ornaments and ivory paper | Palatino serif, 17 px |
| Field Journal | Green cloth binding and lightly ruled pale paper | Segoe UI / Arial sans serif, 15 px |
| Arcane Tome | Indigo leather, silver celestial details and cool ivory paper | Baskerville serif, 17 px |
| Nautical Logbook | Teal leather, brass compass details and weathered cream paper | Cambria serif, 15 px |

Each preset controls the background image, paper treatment, text colors, typefaces, heading sizes/weights, body size/spacing, and compact index typography. Animated page turns use the selected artwork too. Each preset also includes a matching front cover used when opening and closing the book, with the book's name or custom cover title printed on it. Fonts fall back to locally available alternatives; no external font service is needed. Formatting explicitly stored in a source journal is preserved.

**Configure Settings → Module Settings → MK Journal Book → Default book style** controls books set to **Use module default**, including the legacy campaign book. Existing books inherit Classic Parchment until the default or their own style is changed. Explicit per-book choices stay unchanged when the module default changes.

## Personalize the cover

Open the **Book style** palette button to set a **cover title**, **subtitle**, **emblem image**, or **custom cover image** using Foundry's image pickers. A live preview updates as you edit. A blank title uses the journal name; empty image fields restore the preset cover and remove the emblem. The saved design appears during both opening and closing. The cover title does not rename the journal. Owners and GMs can edit it; all readers see the same design.

## Add journals by drag and drop

As GM, drag a **world journal from the Journal sidebar onto a book**. All pages currently in that journal are added to that particular book and shared with all players. To include just one page, drag the **individual page from the journal's page list** instead.

- Every newly created book starts empty. Nothing is added automatically.
- Repeated drops do not duplicate content.
- Pages created in a source journal later stay out until explicitly dropped, or until the whole journal is dropped again.
- Only world journals/pages are accepted. Import compendium journals into the world first.
- Books cannot contain other books or themselves.
- New additions start without a tag. Use **+ Add tag** on a page to organize it; dropping onto a tab does not assign a tag.

A **player who owns the book** can add pages already shared with all players, remove entries, and change that book's tags. If any dropped page is private, the whole drop is rejected with a request for the GM to share it first. Owners cannot change another journal's permissions through this module. Observers can read and navigate but cannot curate the book.

A GM drop grants each selected source page **Observer** access for all current non-GM users, including explicit denials, and raises the default access to at least Observer for future users. Existing Owner access is preserved. The source journal's own ownership and unselected sibling pages are unchanged. The membership list is then saved on the destination book. These are separate Foundry document writes; sharing may already have succeeded if the destination save fails.

**Remove** only removes a page's reference from this book. It does not delete the source, change another book, or revoke access already granted. Use Foundry ownership settings to revoke source-page access.

## Read and turn pages

The first physical page is always **Journal Index**, facing the first included content page. Books now reopen to each reader’s last spread and tag. Enable **Always open at the index** in module settings to use the index every time. Reading positions are stored separately for each Foundry user and book; removed or inaccessible targets fall back to the index. Each journal appears as a compact heading with its included-page count and starting number. Beneath it, every included, readable page has its own indented line and page number. Click a journal heading to open its first included page, or a page line to open that specific page’s spread. Entries use short single-line rows; long names show their full text on hover. Excluded and inaccessible pages never appear. The **Index** button (☷) returns to page 1.

**Previous** and **Next** animate a paper leaf turning across the spine in the appropriate direction. The cover stays still. Repeated page-turn clicks are ignored while the current turn finishes. Systems with **Reduce motion** enabled switch spreads without animation. Permission changes and closing the book immediately cancel the effect and clear its visual snapshots.

A spread displays two pages. Long text and long indexes scroll within their leaf. Pages initially follow journal title and native page order. Book owners can override this using the index handles. Tag tabs show matching pages; **All** includes the index followed by every selected page the viewer can read. Tab counts exclude the index.

Click the **source journal's name beneath the page title** to open that exact page in its original Foundry journal. The separate Open original link has been removed. Title scrollbars stay hidden in every book style. Owners and GMs also have **+ Add tag** (or **Tag: …** for an existing tag) and **Remove**.

## Search and index organization

Click the magnifying glass in the upper-right book controls to search **all included, readable pages**, across journal titles, page titles, and text. Results include a text excerpt; click one or press Enter to open its spread. Escape closes search. Player searches exclude unrevealed secret blocks, and inaccessible or unselected pages never enter the results. PDF/video contents are not indexed; their page and journal titles remain searchable.

Owners and GMs can drag a journal's **⠿ handle** to reorder journal groups, or a page's handle to reorder pages **within its journal**. Drop above or below a target to choose placement. Focus a handle and press **Alt+Up/Down** for keyboard ordering. The saved order belongs to this book and does not edit source journals or membership. Bookmarks retain their targets and update their displayed page numbers. Click **▾/▸** to collapse or expand a journal in the index. The legacy campaign book retains its original automatic order.

## Show a spread to players

GMs can use **Show this spread to players** in the book controls, choose connected recipients, and click **Show page**. Eligible players must already have access to both the book and target page. This opens the target spread once; subsequent navigation remains independent. It does not grant or change ownership. Delivery uses a GM-controlled world setting, rechecks permissions on receipt, ignores duplicate/stale requests, and is not replayed when a player connects later. If a player can see fewer pages than the GM, their spread is formed from their own readable pages.

## Enlarge illustrations

Click an image inside a journal page, or focus it and press Enter/Space, to open a large local viewer. Use **+ / −**, **Fit**, and drag-to-pan for maps. Close it with **×** or Escape to return to the same spread and scroll position. Revoking access, removing the page, or closing the book closes the viewer too.

## Custom page tags

1. Open an included page and click **+ Add tag** beneath its title.
2. Type a tag such as **Quests**, **Factions**, or **Clues**, or choose an existing tag from the input suggestions.
3. Save. A colored tab labeled with the **tag name** appears on the right, listing only pages with that tag.

Each page can have **one optional tag per book**. Click **Tag: …** to change it; clear the field and save to remove it. Tag names allow up to 40 characters. Spaces are normalized and case-only variants share one tab. Tagging a page does not add any other pages or change source permissions.

**All** keeps the full journal index and included pages. Untagged pages appear in **All** and its index; there is no separate untagged tab. Empty tag tabs disappear automatically; if the current tag disappears, the book returns to the index. Tabs show readable-page counts, sort alphabetically, and scroll vertically when they exceed the available space. Long labels have full hover tooltips.

Tags belong to the book, so the same source page can be **Quests** in one book and **Clues** in another. GMs and book owners edit tags; all readers can use their tabs. Hidden, removed, and unselected pages do not expose tag labels or counts.

Books from earlier versions retain their previous categories as tags until edited or cleared. Their previous page/journal/folder inheritance remains the compatibility fallback for existing pages. Newly created books start untagged and do not infer tags from folders. Legacy campaign books retain source-page organization and GM-only tag editing.

## Page-flip speed

In **Configure Settings → Module Settings → MK Journal Book**, adjust **Page flip duration (ms)** using the slider. The same duration controls the unfolding/folding portion of the opening and closing animations. It ranges from **0 to 3,000 ms** in 20 ms steps, with the previous **520 ms** duration as the default. Zero disables page-turn, book-opening and book-closing animations. This world setting applies to all users starting with their next turn; no reload is needed. Reduce-motion preferences always take precedence.

The outgoing spread stays visible while the next pages finish rendering, then the page turns for the full configured duration. Automatic reading-position saves wait until the turn finishes, so they cannot cut the animation short.

## Parchment page notes

Each included journal page can have multiple notes, saved separately for each book. Owners and GMs click **+ Note** in the page's metadata row to write a plain-text reminder (up to 2,000 characters). Choose a **Note style** in the editor: **Parchment** (aged paper with a folded corner), **Yellow Sticky Note** (yellow paper with an adhesive strip), or **Torn Paper** (lined ivory paper with a torn edge and blue ink). The style is saved separately for each note, independent of the book style. Existing notes keep Parchment. All three retain handwriting-style text. Set **Title (optional)** to a custom heading (up to 80 characters), or leave it blank to hide the heading. New notes start without a title; older notes retain “Page note” until you change or clear it. Hover over a note to see its last editor and date in a tooltip; these details no longer occupy space on the paper. Screen readers can access the same details when the note text is focused. Notes rest above the journal text. Long notes scroll inside the slip. Once a page has a note, use **＋** next to **Note** to add another. Use each slip’s pencil to edit that particular note, or click **Note (count)** to choose a note even if another slip covers it. Readers can click **Note (count)** repeatedly to bring each note to the front; removing one leaves its siblings intact.

Drag the **cross-arrow handle** to move a note across the whole paper page, including its heading, margins and footer. Notes stay within their own page and remain in place while you scroll the journal. Its placement is saved for everyone reading that book and adapts when the book is resized. Focus the handle and use **arrow keys** to move it; hold **Shift** for smaller steps. Press **Escape** during a drag to cancel.

Hover over the **note text** to fold the paper upward, exposing the journal beneath it. Module settings provide **Note hover delay (ms)** (0–5,000; default 900) and **Note folding duration (ms)** (0–3,000; default 1,200). The duration applies to folding and returning. These settings are local to the reader’s client. Click the slip’s **pin** to keep it unfolded; click again to allow folding. Pin state is personal and retained while that book sheet remains in memory. It stays lifted while the pointer is within its original area, and settles back when you leave. You can click the underlying text while it is lifted. The move/edit controls restore the note when approached. Readers can fold notes too; this is a local viewing effect and does not save changes. For keyboard access, focus the note text and press **Space** to fold/unfold or **Escape** to unfold. Reduced-motion preferences remove the transition.

Click **Note** or the pencil on the slip to edit it. Adjust the **Tilt** slider from −20° to +20° with a live preview on the page. Cancel discards the preview. The rotated corners remain inside the page. Choose **Reset position, size and tilt** to return the note to the upper-right of the reading area with the style’s default angle. Titles remain editable or optional. Clear the text or select **Remove this note** to remove it. Readers can view notes but cannot change them. These are shared annotations for the book's readers, not private notes. Removing a page hides its note; re-adding the same page restores it. Copies of a page in different books have independent notes. Source journal text is never changed. The generated index is navigation rather than a journal page and has no note.

Drag the slip’s **lower-right corner** to resize it, or focus that handle and use arrow keys (10 px steps; Shift for 1 px). Width ranges from 140–420 px and height from 80–420 px. Notes scale down when necessary to stay within smaller pages. Escape cancels an active resize. Resizing and moving one note do not change its siblings.

The original note is stored under the book's `flags.mk-journal-book.notes` map, keyed by page UUID with periods replaced by tildes. Each saved entry contains `text`, `title` (an empty string hides the heading), `style` (`parchment`, `sticky`, or `torn`), `position` (relative `x`/`y` coordinates from 0 to 1, or `null` for default placement), `positionSpace` (`page` for new full-page positions, `content` for older coordinates), `rotation` (−20 to +20 degrees, or `null` for the style default), optional `size` (`width`/`height` in pixels), `authorId`, `authorName`, and `updatedAt` (milliseconds since the Unix epoch). The legacy campaign book stores its note on the selected source page's `flags.mk-journal-book.note`. Additional notes live in `flags.mk-journal-book.extraNotes`, under the same page key and an independent note ID (the legacy book stores that ID map directly on the source page). Existing books need no migration and retain their original note data. Saved positions from 0.12.0 keep their reading-area reference until moved again; new moves use full-page coordinates. Notes are shown only for included, readable pages; normal book ownership controls editing. If another edit to the same note arrives while its dialog is open, saving asks the editor to reopen the latest note.

## Book sounds

Opening, closing and Previous/Next page turns each have a bundled sound effect. Sounds play locally for the reader only. In **Configure Settings → Module Settings → MK Journal Book**, use **Enable book sounds** and **Book sound volume (%)** (0–100, default 40) for this device. The GM can use the **Book opening sound**, **Book closing sound**, and **Page flip sound** file pickers to choose replacements for all books; clear an individual path to silence it.

Opening audio starts as the cover unfolds; other sounds start with the action. Sounds remain enabled with zero-duration or reduced-motion animations. Refreshes and repeated clicks during an animation do not replay sounds. A new action stops that book's previous sound. Missing or browser-blocked audio never blocks the book; locked audio is skipped rather than queued. The original synthesized WAV effects can be rebuilt with `tools/generate-sounds.py` (Python + NumPy).

## Ribbon bookmarks

Click the small **bookmark icon** at the top of a page to add a bookmark. The index has its own bookmark icon too. Give the bookmark a label and choose its ribbon color, then save.

Bookmarks appear as **colored cloth ribbons hanging from the bottom of the book**. Each shows its page number in the All tab. Hover to see its label; click to open its page, even from another tag tab. The ribbon row scrolls horizontally when needed.

- Bookmarks are **personal to each reader and separate for each book**. Observers can bookmark without editing the book or changing source permissions.
- Click a bookmarked page's icon again, or right-click its ribbon, to edit the label/color. Keyboard users can focus a ribbon and press **F2** or **Shift+F10**.
- To delete one, open its editor, check **Remove this bookmark**, and save.
- Bookmarks persist on the user's Foundry document across reopening and sessions. Adding the same page again edits the existing bookmark.
- Page numbers update with the book's contents. If a target is removed, deleted, or becomes inaccessible, its ribbon and label are hidden. A saved bookmark can reappear if the same target is included and readable again.

## Floating controls

Drag the upper paper edge or printed title to move the book over the canvas. Drag the bottom-right corner mark to resize it. Its position and size persist across refreshes and reopening in the current session. Index, refresh and close controls are printed into the book; there is no surrounding panel or visible window header.

Open books directly from their entries in the Journal sidebar. The extra Journal Book sidebar button and scene-control launcher have been removed. The optional **Alt+J** shortcut still opens a chooser when multiple accessible books exist, opens a single book directly, or offers creation when none exist and the user can create journals.

## Opening and closing the book

Opening a journal book first fades in its named front cover for 180 ms, holds it for 220 ms, then unfolds it into the journal index. The cover matches the selected preset. Tabs, ribbons and page controls become available when the book is fully open. Ordinary page changes, refreshes and journal updates do not replay this animation.

Setting **Page flip duration (ms)** to **0**, enabling **Reduce motion**, or calling `sheet.render({force: true, animate: false})` skips the opening effect. Closing during opening cancels it immediately. Content/permission changes discard opening snapshots before refreshing or closing the live book. The first opening allows up to 400 ms for its bundled cover image to decode, and animation failures fall back to a usable open book.


Click **×** (or use Foundry's close shortcut) to fold the left half over the right page. The front cover matches the book's style and displays its name. The closed book briefly remains on screen for 220 ms, then fades out over 180 ms and is removed. Side tabs and ribbon bookmarks disappear during the fold.

The **Page flip duration (ms)** setting controls the fold. Setting it to **0**, enabling **Reduce motion**, or calling `sheet.close({animate: false})` closes immediately. Closing cancels any ongoing page flip. Repeated close requests share the same animation, and reopening after closing restores the index and the floating position.

Document/permission changes immediately discard animated page copies; losing book access closes it immediately. The animation does not change journal data, tags, or bookmarks.

## Existing campaign books

The previous single campaign book remains available as **Legacy campaign book** when it has selected, readable pages. Its membership is preserved and no pages are automatically copied into newly created books. Use **Alt+J** or `api.open({legacy: true})` to access it.

Legacy book management remains GM-only. Its title is set in Module Settings → MK Journal Book → **Legacy book title**. Its old API operations still work without a destination book UUID. The new per-journal books use their journal names and ownership settings instead.

## Visibility and content

Both the book's and source pages' current permissions are checked. Revoking book access closes its open sheet; revoking access to a source page removes it from that viewer's index and content. Deleted references are ignored. Document changes refresh open books.

Unrevealed secret blocks remain hidden from player readers, including book owners. Revealed blocks are visible. A private parent journal's title is replaced with “Shared journal” when a player can read a selected page but cannot see its parent.

Rich text, images and inline Foundry links/rolls render in the book. Markdown uses Showdown if available, with a readable source fallback. Local/HTTP(S) video files use a player without autoplay. For PDFs, hosted videos and custom page types, click the source journal name beneath the title to use their native viewer.

Content stays in its original journals; books store references. All five SVG book backgrounds and matching front covers are bundled, with no external image or font service required.

## Script API

```js
const api = game.modules.get("mk-journal-book").api;
await api.create({name: "Party Chronicle"}); // Creation dialog, book preselected.
await api.open(); // Choose an accessible book.
await api.open({bookUUID: "JournalEntry.BOOK_ID"});
await api.addJournal("JournalEntry.SOURCE_ID", "JournalEntry.BOOK_ID");
await api.addPage(pageUUID, "JournalEntry.BOOK_ID");
await api.removePage(pageUUID, "JournalEntry.BOOK_ID");
await api.setTag(pageUUID, "Quests", "JournalEntry.BOOK_ID");
await api.setTag(pageUUID, "", "JournalEntry.BOOK_ID"); // Clear the tag.
await api.setNote(pageUUID, "Ask about the silver key.", "JournalEntry.BOOK_ID", {style: "torn", title: "Leads"}); // Omit style/title to retain the current choices; title: "" hides the heading.
await api.setNote(pageUUID, "A clue", "JournalEntry.BOOK_ID", {position: {x: 0.3, y: 0.6}, rotation: -8}); // Layout is per note; omitted fields retain their current values.
await api.setNote(pageUUID, "A clue", "JournalEntry.BOOK_ID", {position: null, rotation: null}); // Reset placement and tilt.
await api.setNote(pageUUID, "", "JournalEntry.BOOK_ID"); // Remove the original note.
const noteId = await api.addNote(pageUUID, "A second clue", "JournalEntry.BOOK_ID", {style: "sticky", size: {width: 260, height: 180}});
await api.setNote(pageUUID, "An updated clue", "JournalEntry.BOOK_ID", {noteId});
await api.setNote(pageUUID, "", "JournalEntry.BOOK_ID", {noteId}); // Remove only this note.
await api.showPage("JournalEntry.BOOK_ID", pageUUID, ["PLAYER_USER_ID"]); // GM only; existing access required.
await api.open({bookUUID: "JournalEntry.BOOK_ID", tag: "Quests"});
await api.open({legacy: true}); // Previous campaign-wide book.
```

Tags are custom strings; an empty string clears the tag. Omitting the destination UUID in add/remove/tag operations addresses the legacy book and requires a GM. Explicit invalid or unauthorized book UUIDs are rejected. Older `setCategory` macros remain compatible: `locations`, `characters`, and `notes` assign the corresponding named tag, while `auto` clears it. Legacy `open({tab: "locations", …})` requests map to the corresponding tag; use `tag` for new macros.

## Implementation and verification

JournalEntry has no module-extensible `type`/`system` field. The creation-dialog choice therefore creates a regular JournalEntry with the registered **MK Journal Book** sheet and module flags. Normal Foundry ownership applies. Books are not unsupported document subtypes. Compendium creation and another module's custom creation template/type options pass through to the prior creation handler. Disabling the module preserves the source journals and book flags; the book renderer requires the module enabled.

Run `npm run check` with Node.js 20+ for syntax and core tests. The browser suite uses Playwright and Chromium: `node tests/browser.test.cjs`, with `CHROMIUM_PATH` if needed. Also run `node tests/closing.browser.test.cjs` and `node tests/opening.browser.test.cjs` for cover-animation coverage. Run `node tests/sounds.browser.test.cjs` for local audio lifecycle and bundled-file decoding checks. Run `node tests/notes.browser.test.cjs` for note styles, optional titles, hover metadata and permissions. Run `node tests/note-layout.browser.test.cjs` for dragging, tilt, keyboard movement, resizing, cancellation and layout permissions. Run `node tests/note-peek.browser.test.cjs` for hover folding, click-through behavior, reduced motion, reader access and legacy positions. Run `node tests/note-cover.browser.test.cjs` for screenshot comparisons ensuring notes stay behind the front cover during closing/opening. Run `node tests/note-opening-position.browser.test.cjs` for first-frame note positions with detached rendering, cached covers and scaled windows. Run `node tests/improvements.browser.test.cjs` for search/secrets, reader memory, note delay/pinning/resizing/multiple notes, drag ordering, targeted presentation, custom covers and image viewing. Run `node tests/flip-continuity.browser.test.cjs` for delayed-render continuity, intermediate animation frames, deferred reading saves, reading-only updates with document metadata, both directions across all styles, and interruption/failure cleanup. All suites use a local harness on port 8765 and should be run sequentially. Test fixtures are not loaded by the module manifest.

Automated tests cover creation choices and cancellation, assigned owners, ordinary journals, multiple independent books, tag isolation, restricted creation/curation, GM publication, player-owned curation, default/inherited access, legacy content, index links and numbering, drag-and-drop, future-page exclusion, secrets, permission revocation, floating movement, resizing, animated turns, repeat-click guards, reduced motion, duration settings, personal bookmark persistence/isolation, ribbon editing/removal, permission filtering, bottom-edge layout, removal of the launch buttons, all five style presets, per-book/default style persistence, actual fonts and images, themed flips, compact index line heights, page links and permission filtering. Tag checks cover custom names, case/whitespace normalization, reserved names, safe HTML, category compatibility, per-book persistence, editing/clearing, exact filtering, empty-tab fallback, many-tag scrolling, compact layouts, and access revoked during editing. Closing checks cover all five front covers, preserved page layout, cover hold/fade, repeated close requests, interrupted flips, stale renders, permission revocation, queued API reopening, reduced motion, zero duration, and graceful animation failure. Opening checks cover fade/hold/unfold timing, initial/repeated opening, no replay on navigation/refresh, native sheets, compact geometry, close/update interruption, denied access, reduced motion, instant opening, cover decoding and failure recovery. Source-journal links are checked by mouse and keyboard on both leaves, and title scrollbar visibility is checked across presets.

Tests use mocked Foundry APIs. Live testing in a licensed Foundry world has not been performed here; the manifest deliberately omits a verified version. Check creation, ownership and drag-and-drop in your world before a session, especially alongside modules that replace journal creation or sheets.

Official API references:

- https://foundryvtt.com/api/v13/classes/foundry.ClientDocument.html#createDialog
- https://foundryvtt.com/api/v13/classes/foundry.applications.api.DocumentSheetV2.html
- https://foundryvtt.com/api/v13/classes/foundry.applications.api.DialogV2.html
- https://foundryvtt.com/api/v13/classes/foundry.applications.apps.DocumentSheetConfig.html
- https://foundryvtt.com/api/v13/classes/foundry.documents.JournalEntry.html
