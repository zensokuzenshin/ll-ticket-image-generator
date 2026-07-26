/* Shared reactive app state (Svelte 5 runes). The working template `A` is a
   deep $state proxy, so mutating e.g. A.fields[i].x from anywhere re-renders
   the canvas and every bound control — no manual DOM sync. Keys starting with
   `_` (like _img, _stack) are runtime-only and never serialized. */
export const app = $state({
  A: null,                    // active working template
  lang: 'ko',
  // selection by id so it survives undo/redo restores. `ids` is the full
  // (ctrl+click) multi-selection; type/id is the primary item — the one the
  // sidebar panels edit. ids always contains id when something is selected.
  sel: { type: null, id: null, ids: [] },

  // The catalogue (keys/names/groups) comes from presets/index.json at boot;
  // `presets` holds only the templates actually downloaded so far — one show is
  // fetched when it is picked, never the whole list.
  presets: {},                // key → template, filled in as shows are opened
  presetGroups: null,         // catalogue tree [{name, series:[{name, keys}]}], null = flat list
  presetKeys: [],             // every preset key, in index.json order
  presetNames: {},            // key → label from index.json (absent = resolved from the file)
  presetPaths: null,          // key → its file under presets/ (dev "save to source file")
  presetKey: '',
  presetErr: false,

  // >0 while a template is being fetched/decoded; starts busy for the boot load.
  // showBusy is the same thing after a short delay, so cached (instant) loads
  // never flash a spinner — that is the one the UI watches.
  busy: 1,
  showBusy: false,

  zoom: 1,
  showBoxes: false,           // 枠: exact bounding boxes
  showGuideLines: true,
  fontState: 'loading',       // 'loading' | 'ok' | 'system'
  fontTick: 0,                // bumped when fonts finish loading → re-render
  renderTick: 0,              // bumped to force a canvas repaint (e.g. after export)

  fname: 'ticket',
  embed: false,
  histOn: true,
  showHelp: false,
  canvasEl: null,             // the <canvas>, set by Stage on mount (for export & history thumbs)

  // reference overlay (never exported)
  refSrc: '',
  refOn: false,
  refOpacity: 45,

  // collapsible sidebar sections (true = collapsed)
  secCollapsed: { preset: false, fields: false, attr: true, guides: true, images: true, layout: true, ref: true },
})

let uid = 1
export const nid = () => 'id' + (uid++)
/** Session restore brings back ids minted last session — continue above them. */
export const seedNid = n => { if (n >= uid) uid = n + 1 }

/** The primary selected field/image object inside the current template, or null. */
export function selRef() {
  if (!app.A || !app.sel.id) return null
  if (app.sel.type === 'field') return app.A.fields.find(f => f.id === app.sel.id) || null
  if (app.sel.type === 'image') return app.A.images.find(im => im.id === app.sel.id) || null
  return null
}

/** Every selected object as {type, o}, in template order (stale ids drop out). */
export function selRefs() {
  if (!app.A || !app.sel.ids.length) return []
  const out = []
  for (const f of app.A.fields) if (app.sel.ids.includes(f.id)) out.push({ type: 'field', o: f })
  for (const im of app.A.images) if (app.sel.ids.includes(im.id)) out.push({ type: 'image', o: im })
  return out
}

const typeOf = id => app.A && app.A.fields.some(f => f.id === id) ? 'field' : 'image'

/** Plain click: selection becomes just this item (or empty). */
export function select(type, ref) {
  app.sel.type = ref ? type : null
  app.sel.id = ref ? ref.id : null
  app.sel.ids = ref ? [ref.id] : []
}

/** Ctrl+click: toggle membership; a newly added item becomes primary. */
export function toggleSelect(type, ref) {
  if (!ref) return
  if (app.sel.ids.includes(ref.id)) deselectRef(ref)
  else {
    app.sel.ids = [...app.sel.ids, ref.id]
    app.sel.type = type; app.sel.id = ref.id
  }
}

/** Plain click on an already-selected member keeps the group, only moves primary. */
export function primarySelect(type, ref) {
  if (app.sel.ids.includes(ref.id)) { app.sel.type = type; app.sel.id = ref.id }
  else select(type, ref)
}

/** Replace the selection with a set of {type, o} (e.g. fresh duplicates). */
export function selectMany(items) {
  if (!items.length) { select(null, null); return }
  app.sel.ids = items.map(s => s.o.id)
  const last = items[items.length - 1]
  app.sel.type = last.type; app.sel.id = last.o.id
}

/** Drop one item from the selection (ctrl+click toggle-off, or it was deleted). */
export function deselectRef(ref) {
  if (!app.sel.ids.includes(ref.id)) return
  app.sel.ids = app.sel.ids.filter(x => x !== ref.id)
  if (app.sel.id === ref.id) {
    const next = app.sel.ids[app.sel.ids.length - 1] || null
    app.sel.id = next
    app.sel.type = next ? typeOf(next) : null
  }
}
