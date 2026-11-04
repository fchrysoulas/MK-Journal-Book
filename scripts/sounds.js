import {ID, safeMediaURL} from "./core.js";

export const BOOK_SOUNDS = {
  open: {key: "openSound", name: "Book opening sound", file: "book-open.wav"},
  close: {key: "closeSound", name: "Book closing sound", file: "book-close.wav"},
  flip: {key: "flipSound", name: "Page flip sound", file: "page-flip.wav"}
};
const active = new Set();

export function soundVolume(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : .4;
}

export function registerSoundSettings() {
  const stopAll = () => {for (const audio of [...active]) audio.stop();};
  game.settings.register(ID, "soundsEnabled", {
    name: "Enable book sounds", hint: "Play book opening, closing and page flip sounds on this device only.",
    scope: "client", config: true, type: Boolean, default: true, onChange: stopAll
  });
  game.settings.register(ID, "soundVolume", {
    name: "Book sound volume (%)", hint: "Volume on this device. Set to 0 to mute book sounds.",
    scope: "client", config: true,
    type: new foundry.data.fields.NumberField({nullable: false, integer: true, min: 0, max: 100, step: 5}),
    default: 40, onChange: stopAll
  });
  for (const {key, name, file} of Object.values(BOOK_SOUNDS)) {
    game.settings.register(ID, key, {
      name, hint: "Choose a short audio file, or clear this field to silence this action. Applies to all books. Each reader hears only their own actions.",
      scope: "world", config: true,
      type: new foundry.data.fields.FilePathField({categories: ["AUDIO"], nullable: false, blank: true, base64: false}),
      default: `modules/${ID}/assets/sounds/${file}`, onChange: stopAll
    });
  }
}

/** Local, cancellable one-shot audio. No socket messages or shared Sound instances. */
export class BookSounds {
  _token = 0;
  _timer = null;
  _sound = null;

  stop() {
    this._token++;
    clearTimeout(this._timer); this._timer = null;
    const sound = this._sound; this._sound = null;
    active.delete(this);
    if (sound) {
      try {Promise.resolve(sound.stop()).catch(() => {});} catch { /* A failed audio backend must not block the book. */ }
    }
  }

  play(kind, {delay = 0} = {}) {
    this.stop();
    if (!Object.hasOwn(BOOK_SOUNDS, kind)) return;
    const token = this._token;
    const src = safeMediaURL(game.settings.get(ID, BOOK_SOUNDS[kind].key));
    const enabled = () => game.settings.get(ID, "soundsEnabled") !== false && soundVolume(game.settings.get(ID, "soundVolume")) > 0;
    const available = () => token === this._token && enabled() && game.audio && !game.audio.locked && !game.audio.globalMute;
    if (!src || !available() || !globalThis.foundry?.audio?.Sound) return;
    active.add(this);
    const start = async () => {
      this._timer = null;
      if (!available()) {if (token === this._token) this.stop(); return;}
      let sound;
      try {
        sound = new foundry.audio.Sound(src, {context: game.audio.interface});
        this._sound = sound;
        await sound.load({autoplay: false});
        // An interrupted open/turn must never begin playing after a slow file load.
        if (!available()) {if (token === this._token) this.stop(); return;}
        await sound.play({volume: soundVolume(game.settings.get(ID, "soundVolume")), loop: false, offset: 0,
          onended: () => {if (token === this._token) {this._sound = null; active.delete(this);}}
        });
        if (token !== this._token) await sound.stop();
      } catch (error) {
        if (token === this._token) this.stop();
        console.warn("MK Journal Book | Sound could not play", error);
      }
    };
    if (delay > 0) this._timer = setTimeout(() => {void start();}, delay);
    else void start();
  }
}
