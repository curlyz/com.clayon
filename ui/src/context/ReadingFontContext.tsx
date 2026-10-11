import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_READING_FONT,
  ensureReadingFontLoaded,
  isReadingFont,
  type ReadingFont,
} from "@/lib/readingFonts";

interface ReadingFontContextValue {
  font: ReadingFont;
  setFont: (font: ReadingFont) => void;
}

export const READING_FONT_STORAGE_KEY = "clayon.readerFont";

const ReadingFontContext = createContext<ReadingFontContextValue | undefined>(undefined);

function resolveFontFromDocument(): ReadingFont {
  if (typeof document === "undefined") return DEFAULT_READING_FONT;
  const value = document.documentElement.dataset.readerFont ?? "";
  return isReadingFont(value) ? value : DEFAULT_READING_FONT;
}

function applyReadingFont(font: ReadingFont) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.readerFont = font;
  ensureReadingFontLoaded(font);
}

export function ReadingFontProvider({ children }: { children: ReactNode }) {
  // The pre-paint script in index.html has already set the attribute before
  // first paint, so initializing from the document never flashes the default.
  const [font, setFontState] = useState<ReadingFont>(() => resolveFontFromDocument());

  const setFont = useCallback((nextFont: ReadingFont) => {
    setFontState(nextFont);
  }, []);

  useEffect(() => {
    applyReadingFont(font);
    try {
      // JSON string, matching the pre-paint script's read format.
      localStorage.setItem(READING_FONT_STORAGE_KEY, JSON.stringify(font));
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [font]);

  const value = useMemo(
    () => ({ font, setFont }),
    [font, setFont],
  );

  return (
    <ReadingFontContext.Provider value={value}>
      {children}
    </ReadingFontContext.Provider>
  );
}

export function useReadingFont() {
  const context = useContext(ReadingFontContext);
  if (!context) {
    throw new Error("useReadingFont must be used within ReadingFontProvider");
  }
  return context;
}
