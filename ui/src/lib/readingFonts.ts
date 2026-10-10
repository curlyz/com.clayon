/**
 * Reading-font catalogue: the single owner of font ids, labels, and lazy
 * webfont loaders for the reader font switcher.
 *
 * The DOM/storage contract (keep in sync with ReadingFontContext.tsx, the
 * index.html pre-paint script, and the `[data-reader-font]` token maps in
 * index.css):
 * - `<html data-reader-font="<id>">` is the whole DOM contract.
 * - `localStorage["paperclip.readerFont"]` holds the id as a JSON string.
 *
 * The chosen face is global (chrome, menus, forms — everything); only
 * mono/code glyphs keep their own face. Font stacks live in index.css;
 * loaders are lazy so a face's woff2 ships only when it is picked (or
 * previewed in the picker).
 */

export const ReadingFontEnum = {
  Inter: "inter",
  OpenDyslexic: "open-dyslexic",
  AtkinsonHyperlegible: "atkinson-hyperlegible",
  Lexend: "lexend",
  Literata: "literata",
  SystemSans: "system-sans",
  MonoLisaNerd: "monolisa-nerd",
} as const;

export const ReadingFontEnumValues = [
  ReadingFontEnum.Inter,
  ReadingFontEnum.OpenDyslexic,
  ReadingFontEnum.AtkinsonHyperlegible,
  ReadingFontEnum.Lexend,
  ReadingFontEnum.Literata,
  ReadingFontEnum.SystemSans,
  ReadingFontEnum.MonoLisaNerd,
] as const;

export type ReadingFont = (typeof ReadingFontEnum)[keyof typeof ReadingFontEnum];

export const DEFAULT_READING_FONT: ReadingFont = ReadingFontEnum.Inter;

const readingFontIds: ReadonlySet<string> = new Set(ReadingFontEnumValues);

export function isReadingFont(value: string): value is ReadingFont {
  return readingFontIds.has(value);
}

type ReadingFontMeta = {
  label: string;
  /** Loads the self-hosted 400-weight woff2 css; system/app faces stay undefined. */
  load?: () => Promise<unknown>;
};

export const READING_FONTS: Readonly<Record<ReadingFont, ReadingFontMeta>> = {
  [ReadingFontEnum.Inter]: {
    label: "Inter",
  },
  [ReadingFontEnum.OpenDyslexic]: {
    label: "OpenDyslexic",
    load: () => import("@fontsource/opendyslexic/400.css"),
  },
  [ReadingFontEnum.AtkinsonHyperlegible]: {
    label: "Atkinson Hyperlegible",
    load: () => import("@fontsource/atkinson-hyperlegible/400.css"),
  },
  [ReadingFontEnum.Lexend]: {
    label: "Lexend",
    load: () => import("@fontsource/lexend/400.css"),
  },
  [ReadingFontEnum.Literata]: {
    label: "Literata",
    load: () => import("@fontsource/literata/400.css"),
  },
  [ReadingFontEnum.SystemSans]: {
    label: "System sans",
  },
  // Referenced by family name only: MonoLisa is a commercial face and this
  // repo is public, so its woff2 is never committed. Viewers who have it
  // installed (the operator does) get it; everyone else gets the mono
  // fallback in the css stack. No loader for the same reason.
  [ReadingFontEnum.MonoLisaNerd]: {
    label: "MonoLisa Nerd Font",
  },
};

const loadedFonts = new Set<ReadingFont>();

/** Loads a face's webfont css once; safe to call repeatedly. */
export function ensureReadingFontLoaded(font: ReadingFont): void {
  if (loadedFonts.has(font)) return;
  const loader = READING_FONTS[font].load;
  if (!loader) {
    loadedFonts.add(font);
    return;
  }
  loadedFonts.add(font);
  void loader().catch(() => {
    // A failed woff2 just falls back to the stack's next family; do not retry.
  });
}

/** Loads every face once — used when the picker opens so each option previews in its own face. */
export function ensureAllReadingFontsLoaded(): void {
  for (const id of ReadingFontEnumValues) {
    ensureReadingFontLoaded(id);
  }
}
