import {presetOptions, isBookPreset} from "./presets.js";
import {ID, BOOK_SHEET_ID, escapeHTML as e} from "./core.js";

/** JournalEntry has no system/type field: use a registered sheet and flags. */
export function bookCreationData(data, ownerId, user, users) {
  const result = {...data, flags: {...data.flags,
    core: {...data.flags?.core, sheetClass: BOOK_SHEET_ID},
    [ID]: {...data.flags?.[ID], book: true, pages: [], tags: {}, tagVersion: 1, notes: {}}
  }};
  // Creating a book publishes the empty container. Adding content remains explicit.
  const owner = user.isGM ? Array.from(users).find(u => u.id === ownerId) : user;
  result.ownership = {default: 2, ...(owner ? {[owner.id]: 3} : {})};
  return result;
}

export function registerJournalIntegration(Sheet) {
  const Journal = CONFIG.JournalEntry.documentClass;
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Journal, ID, Sheet, {
    label: "MK Journal Book", makeDefault: false
  });
  const original = Journal.createDialog;
  if (original.mkJournalBook) return;
  async function createDialog(data = {}, createOptions = {}, options = {}) {
    // Leave compendiums, embedded documents and other modules' custom forms intact.
    if (createOptions.pack || createOptions.parent || options.template || options.types)
      return original.call(this, data, createOptions, options);
    if (!this.canUserCreate(game.user)) throw new Error("You do not have permission to create journal entries.");
    const folders = options.folders ?? Array.from(game.folders).filter(f => f.type === "JournalEntry");
    const selectedFolder = data.folder?.id ?? data.folder ?? "";
    const initialBook = data.flags?.[ID]?.book === true;
    const owners = Array.from(game.users).filter(u => !u.isGM);
    const initialStyle = data.flags?.[ID]?.style;
    const content = `<div class="form-group"><label for="mkjb-create-name">Name</label><div class="form-fields"><input id="mkjb-create-name" name="name" type="text" value="${e(data.name ?? this.defaultName())}" required autofocus></div></div>
      <div class="form-group"><label for="mkjb-create-type">Journal type</label><div class="form-fields"><select id="mkjb-create-type" name="journalKind"><option value="journal" ${!initialBook ? "selected" : ""}>Journal Entry</option><option value="book" ${initialBook ? "selected" : ""}>MK Journal Book</option></select></div></div>
      <div class="form-group"><label for="mkjb-create-folder">Folder</label><div class="form-fields"><select id="mkjb-create-folder" name="folder"><option value="">None</option>${folders.map(f => `<option value="${e(f.id)}" ${selectedFolder === f.id ? "selected" : ""}>${e(f.name)}</option>`).join("")}</select></div></div>
      <div class="form-group"><label for="mkjb-create-style">Book style</label><div class="form-fields"><select id="mkjb-create-style" name="bookStyle">${presetOptions(initialStyle, {inherit: true})}</select></div><p class="hint">Applies to MK Journal Book.</p></div>
      <div class="form-group"><label for="mkjb-create-owner">Book owner</label><div class="form-fields">${game.user.isGM ? `<select id="mkjb-create-owner" name="bookOwner"><option value="">GM only</option>${owners.map(u => `<option value="${e(u.id)}">${e(u.name)}</option>`).join("")}</select>` : `<span>${e(game.user.name)}</span>`}</div><p class="hint">For MK Journal Book: the owner can manage its contents. Other players start with Observer access. Change access later with Configure Ownership.</p></div>`;
    return foundry.applications.api.DialogV2.prompt({
      ...options, window: {...options.window, title: "Create Journal Entry"}, content, rejectClose: false,
      ok: {label: "Create New Journal Entry", icon: "fa-solid fa-check", callback: async (_event, button) => {
        const form = button.form.elements;
        const name = form.namedItem("name").value.trim();
        if (!name) throw new Error("Enter a journal name.");
        let source = {...data, name, folder: form.namedItem("folder").value || null};
        if (form.namedItem("journalKind").value === "book") {
          source = bookCreationData(source, form.namedItem("bookOwner")?.value, game.user, game.users);
          const style = form.namedItem("bookStyle").value;
          source.flags[ID].style = isBookPreset(style) ? style : null;
        } else {
          // A preselected book can still be changed back to an ordinary journal.
          source.flags = {...source.flags};
          delete source.flags[ID];
          if (source.flags.core?.sheetClass === BOOK_SHEET_ID) {
            source.flags.core = {...source.flags.core}; delete source.flags.core.sheetClass;
          }
        }
        const document = await this.create(source, {...createOptions, renderSheet: false});
        if (document && createOptions.renderSheet !== false) await document.sheet.render({force: true});
        return document ?? null;
      }}
    });
  }
  createDialog.mkJournalBook = true;
  Journal.createDialog = createDialog;
}
