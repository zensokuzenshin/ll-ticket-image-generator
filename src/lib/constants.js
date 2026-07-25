// Default canvas size — the Kodak Mini 2 Retro P210R card (5:8). Templates
// carry their own cw/ch (set per printer); these are only the fallback for
// templates that omit them and the pre-boot placeholder.
export const CW = 2000
export const CH = 3200

// The original ticket renders Japanese in Hiragino, so it leads the default
// stack. It is served by the Adobe Fonts kit in index.html under this family
// name; if that is blocked the stack falls through to Noto on its own.
export const KIT_FAMILY = 'hiragino-kaku-gothic-pron'
export const DEFAULT_FONT = "'hiragino-kaku-gothic-pron','Hiragino Kaku Gothic ProN','Noto Sans JP'"
