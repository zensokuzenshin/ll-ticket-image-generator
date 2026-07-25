/* Shared reactive app state (Svelte 5 runes). The working template `A` is a
   deep $state proxy, so mutating e.g. A.fields[i].x from anywhere re-renders
   the canvas and every bound control — no manual DOM sync. Keys starting with
   `_` (like _img, _stack) are runtime-only and never serialized. */
export const app = $state({
  A: null,                    // active working template
  lang: 'ko',
  sel: { type: null, id: null },   // selection by id so it survives undo/redo restores

  presets: null,              // key → template (fetched from presets/)
  presetKey: '',
  presetErr: false,

  zoom: 1,
  showBoxes: false,           // 枠: exact bounding boxes
  showGuideLines: true,
  fontState: 'loading',       // 'loading' | 'ok' | 'system'
  fontTick: 0,                // bumped when fonts finish loading → re-render
  renderTick: 0,              // bumped to force a canvas repaint (e.g. after export)

  fname: 'ticket',
  embed: false,
  histOn: true,
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

/** The selected field/image object inside the current template, or null. */
export function selRef() {
  if (!app.A || !app.sel.id) return null
  if (app.sel.type === 'field') return app.A.fields.find(f => f.id === app.sel.id) || null
  if (app.sel.type === 'image') return app.A.images.find(im => im.id === app.sel.id) || null
  return null
}

export function select(type, ref) {
  app.sel.type = ref ? type : null
  app.sel.id = ref ? ref.id : null
}
