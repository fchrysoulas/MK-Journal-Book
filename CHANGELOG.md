# Changelog

## 0.14.1 — 2026-11-01

- Fixed page turns jumping to the destination before the animation starts when Foundry finishes rendering asynchronously. Keep the outgoing spread in place until the turning sheet is ready.
- Deferred automatic reading-position saves until after page turns. Reading-only User updates with nested or flattened document statistics no longer interrupt animations.
- Cleaned up held spreads when a turn is cancelled, permissions change, or the animation API fails. Preserved configured duration, both directions, reduced-motion behavior, notes and all five book styles.
- Added browser regressions for delayed rendering and intermediate frames, plus unit checks for reading-only hook updates.

## 0.14.0 — 2026-11-01

- Added full-text book search with clickable excerpts, title/journal matching and permission-filtered results. Unrevealed secrets are excluded from player searches, including during asynchronous permission changes.
- Remembered the last spread/tag independently per reader and book, with an Always open at the index preference and safe fallback for unavailable pages.
- Added configurable hover delay/folding duration and personal note pins.
- Added multiple notes per page, independent note IDs, pointer/keyboard resizing, and live tilt preview with cancellation. Preserved original notes and older coordinate spaces without a migration.
- Added journal-group and within-journal page ordering by index drag handles or Alt+Up/Down, plus collapsible groups. Bookmarks follow their targets and current numbering.
- Added one-shot GM presentation to selected connected players who already have access, with permission checks and duplicate/stale request handling.
- Added cover title/subtitle, image picker fields for custom artwork/emblems, and a live preview. Both cover animations use the saved design.
- Added a local image viewer with zoom, fit, pan and keyboard access, preserving the book underneath and closing on permission changes.
- Added unit and browser regression coverage for the combined features; retained the earlier opening-position and cover-stacking fixes.

## 0.13.2 — 2026-11-01

- Fixed notes starting at the wrong position during opening. Note layout now finishes after Foundry mounts the window and before animation snapshots are created.
- Used page-local coordinates so window scale effects do not shift automatic or older note placements.
- Added regression coverage for detached first-render HTML, cached covers, scaled windows, both leaves and all book/note styles; compared initial animation coordinates against the fully open book.

## 0.13.1 — 2026-11-01

- Fixed notes appearing over the front cover during closing and opening. Stationary-page overlays now stay below the moving cover.
- Kept notes visible on inside pages during the animation and preserved all saved note data.
- Added screenshot-based regression checks across all five book presets and three note styles, including tilted notes near page edges.

## 0.13.0 — 2026-11-01

- Added a slow hover fold on note text to reveal and interact with the journal underneath. Moving away restores the note; hovering the controls also restores it.
- Kept the original hover footprint during folding to prevent flicker. Added Space/Escape keyboard access and reduced-motion support. Hover folding is local and never changes shared note data.
- Expanded dragging to the whole paper page, including headings, margins and footers, while keeping notes within their own page.
- Placed notes above journal text so every fold reveals content without reflow. Reset returns to automatic placement at the reading area’s upper-right corner.
- Preserved older reading-area coordinates until notes are moved again, with saved full-page coordinates for new moves.
- Added browser coverage for folding, click-through, layout stability, full-page bounds, old placements and permissions.

## 0.12.0 — 2026-11-01

- Added draggable notes with per-book, per-page saved positions. Moved notes stay in place while the journal text scrolls.
- Added a −20° to +20° tilt slider and a Reset position and tilt option to the note editor. Titles remain editable or optional.
- Added keyboard movement with arrow keys and Shift for finer steps. Escape cancels an active drag.
- Kept rotated notes within their page when the book is resized and preserved their layout in page-turn snapshots.
- Cancelled unfinished gestures on refresh, permission changes, concurrent edits and close; readers cannot reposition notes.
- Added layout validation, geometry tests and browser coverage for dragging, tilting, persistence, reset, all styles and gesture cleanup.

## 0.11.0 — 2026-11-01

- Added an optional, editable title to each note. Blank titles hide the heading; existing notes retain their Page note label.
- Moved author and edit date into a hover tooltip, removing the permanent metadata footer. The same details remain available to screen readers.
- Preserved titles independently per page and book, including saved edits, page-turn snapshots, legacy notes and text-only API updates.
- Added title validation and browser coverage for optional headings, metadata tooltips and all three note styles across five book presets.

## 0.10.0 — 2026-11-01

- Added three independently selectable note styles: Parchment, Yellow Sticky Note and Torn Paper.
- Added the Note style selector to the note editor and saved each choice alongside its page metadata. Existing notes default to Parchment.
- Preserved note styling in page-turn snapshots, reader views, compact layouts and legacy books. Text-only API edits retain the current style.
- Expanded note validation and browser checks for all three note styles across all five book presets.

## 0.9.0 — 2026-11-01

- Added a + Note control to every included journal page and parchment slips with handwritten text, last editor and edit date.
- Added per-book page notes metadata and owner/GM editing, including removal, plain-text safety, length limits and stale-edit detection. Readers can view shared notes.
- Preserved notes independently across books and reopenings, while hiding removed or unreadable pages. Legacy books keep notes on their source pages.
- Included note artwork and scrolling in page-turn snapshots; added compact layouts and the setNote API.
- Added note data/rendering tests and browser coverage for editing, permissions, persistence, all five styles and legacy books.

## 0.8.0 — 2026-11-01

- Removed the decorative ribbon at the spine from all five open-book backgrounds.
- Added three original bundled WAV effects for opening, closing and Previous/Next page flips, with opening audio aligned to the unfolding cover.
- Added GM audio file pickers for each action, plus a personal enable switch and 0–100 volume slider. Blank paths silence individual actions.
- Kept audio local to each reader, independent of reduced motion and animation speed, with cancellation for superseded actions, mute changes and revoked access.
- Guarded initial renders against duplicate sound playback and kept audio failures from blocking the UI.
- Added audio lifecycle tests and browser decoding checks for the bundled effects.

## 0.7.0 — 2026-11-01

- Added Arcane Tome and Nautical Logbook presets, each with distinct open-book artwork, a matching animated front cover, paper colors, typography and compact index styling.
- Made both new styles available in journal creation, per-book appearance and the module default setting.
- Raised the Previous/Next row by 12 px while preserving the content area, and made both labels bold.
- Extended existing preset and animation checks to all five styles.

## 0.6.0 — 2026-11-01

- Added the reverse cover animation on opening: fade in the front cover for 180 ms, hold for 220 ms, then unfold into the index using the page-flip duration setting.
- Shared the cover geometry/artwork with closing, preserved floating position and preset typography, and avoided flashing live pages before the cover appears.
- Limited opening animation to new/reopened windows. Refreshes and page navigation do not replay it; repeated render calls share the current opening.
- Added interruption cleanup for closing, document changes and permission revocation. Reduced motion, duration zero and explicit animate:false skip the effect; animation failures restore usable controls.
- Hid page-title scrollbars across all presets while retaining overflow handling for long titles.
- Moved Open original to the source journal's name beneath each page title, with keyboard activation and matching hover styling. Removed the separate link and updated native-viewer fallback guidance.
- Added opening lifecycle coverage and expanded header/source-link checks.

## 0.5.0 — 2026-11-01

- Added a closing sequence: fold the front half over the right page, show the front cover for 220 ms, then fade out over 180 ms and remove the window.
- Added matching front-cover SVG artwork for Classic Parchment, Gothic Grimoire and Field Journal, with the book's name printed on the cover. Covers preload with the open book.
- Reused the page-flip duration setting for the fold. Zero duration, reduced motion and explicit nonanimated close skip the effect.
- Preserved floating geometry and snapshot layout, hid tabs/ribbons during closing, canceled active page turns, and blocked interactions and stale renders during the animation.
- Made repeated close requests share one sequence; queued API reopening waits until the close completes.
- Discarded closing snapshots immediately on content/permission updates, closed immediately on access revocation, and added animation-failure cleanup.
- Added dedicated browser coverage for covers, timing, lifecycle, layout, permissions and motion preferences.

## 0.4.2 — 2026-11-01

- Removed the automatic # prefix from side-tab names and their hover labels.

## 0.4.1 — 2026-11-01

- Removed the automatic No tag tab. Untagged pages remain accessible through All and the journal index.

## 0.4.0 — 2026-11-01

- Replaced the fixed Locations / Characters / Notes tabs with dynamic custom page-tag tabs. All retains the journal index; No tag appears only when needed.
- Added owner/GM tag editing on each page, with existing-tag suggestions, arbitrary names up to 40 characters, and clearing. One optional tag is saved per page per book.
- Normalized whitespace and case variants, added readable-page counts and stable colors, and made the side tabs scroll for larger tag collections.
- Preserved older category organization as a compatibility fallback. New books and newly added pages start untagged; adding pages remains manual.
- Added the setTag API and direct opening by tag, retaining older category macros. Empty active tags fall back to the index.
- Cleared tag labels immediately on document/permission changes, and verified owner access again when saving pending edits.
- Added regression tests for tag safety, per-book isolation, filtering, persistence, permissions, scrolling and all three presets.

## 0.3.0 — 2026-11-01

- Added Classic Parchment, Gothic Grimoire and Field Journal presets, with distinct bundled SVG artwork, paper treatments, font families, font sizes and text styles.
- Added a world default style, a creation-dialog style selector, and an owner/GM Book style palette control. Appearance is saved separately for each book and shared with its readers.
- Applied the selected artwork and typography to page-flip snapshots.
- Replaced tall index summary entries with compact journal headings and individual clickable page lines, each showing its page number.
- Kept hidden/unselected pages out of the index, preserved same-name journal identities, and added regression coverage for style selection, persistence, page links, compact sizing and permission filtering.

## 0.2.1 — 2026-11-01

- Added a Page flip duration (ms) settings slider: 0–3,000 ms, 20 ms steps, default 520 ms. Zero skips the animation; reduced motion remains respected.
- Added personal bookmarks for all readers, including Observers, with editable labels and colors saved separately per book/user.
- Bookmarks hang along the bottom as colored ribbons showing page numbers. Click to jump; right-click or press F2/Shift+F10 to edit/remove.
- Hidden, deleted or removed pages no longer expose bookmark labels. Duplicate bookmarks update the existing ribbon.
- Removed the extra Journal Book sidebar and scene-control buttons. Books open through their journal entries; Alt+J and legacy API access remain available.
- Added regression tests for animation timing, bookmarks, persistence, isolation, permissions, compact layout and absent launcher buttons.

## 0.2.0 — 2026-11-01

- Added Journal type → MK Journal Book and Book owner to Create Journal Entry, alongside ordinary journal creation.
- Books are separate JournalEntry documents with a registered floating sheet, native ownership and independent page membership/category settings.
- Selected owners can curate already-shared pages; GMs can publish private pages. Book and source permissions are enforced separately.
- Added an accessible-book chooser to the sidebar, scene control and Alt+J. Retained previous campaign-book membership as a legacy option.
- Added directional paper-turn animation for Previous/Next, with static leather cover, inert visual snapshots, repeat-click protection and reduced-motion support.
- Permission changes and closing immediately cancel animated snapshots.
- Added automated coverage for creation, owners, separate books, categories, revocation, ordinary journals, animation and reduced motion.

## 0.1.4 — 2026-11-01

- Added a clickable Journal Index as the first physical page of the All tab, facing the first included journal page.
- Lists each included, readable journal once, with its page count and starting page number; same-named journals retain separate identities.
- Added a return-to-index button and reset ordinary reopening to the index while preserving window geometry.
- Index membership and page numbers update with additions, removals and permission changes. Drag-and-drop remains the only in-book addition workflow.
- Added core and browser regression coverage for index grouping, links, numbering, removal and privacy.

## 0.1.3 — 2026-11-01

- Removed the contents overview, search/index, and Add pages picker.
- Both book leaves now show journal pages directly; Previous / Next turns a two-page spread.
- GMs can drop a world journal to add its current pages, or drop an individual page to add only that page. Later pages are not automatically added.
- Drops grant all players access while preserving Owner access; repeated drops do not duplicate pages.
- Per-page category, Open original, and Remove controls address the correct leaf.
- Added browser coverage for real drop events, whole-journal batches, duplicates, invalid/compendium drops, per-leaf controls, privacy and floating geometry.

## 0.1.2 — 2026-11-01

- Fixed floating placement by enabling native ApplicationV2 window positioning, hiding its chrome, and explicitly removing the book from page layout with fixed positioning.
- Added a broad drag area along the upper paper edge, in addition to the title.
- Centers the book on first opening and retains its position and dimensions across refreshes and reopening during the session.
- Browser regression checks now measure actual screen movement, position persistence and resize geometry.

## 0.1.1 — 2026-11-01

- Replaced automatic collection with explicit GM Add pages / Remove controls. Existing worlds start with no selected pages.
- Adding a page now grants all players Observer access while preserving existing Owner access, in the same page update as book membership. Parent journals and sibling pages are unchanged.
- Removing a page changes book membership only; its sharing permissions remain unchanged.
- Moved all four category tabs to the right side of the book.
- Removed the application frame, outer background, toolbar and caption. Close, refresh, move and resize controls are integrated into the book.
- Added regression coverage for manual membership, sharing, denied players, removal, frameless controls and sidebar geometry.

## 0.1.0 — 2026-11-01

- Initial standalone ApplicationV2 module targeting Foundry VTT 13–14.
- Open-book SVG background with parchment, leather binding, and bookmark tabs.
- All, Locations, Characters, and Notes categories with per-page GM assignment and folder inheritance.
- Automatic world journal aggregation, title search, contents index, and previous/next navigation.
- Per-user access filtering, secret-block handling, and refresh on document/ownership changes.
- Journal sidebar launcher, scene control button, Alt+J binding, and module API.
- Text/image/local-video rendering and native viewer fallback for other page types.
- Automated permission/filter tests and a mocked browser test fixture.
