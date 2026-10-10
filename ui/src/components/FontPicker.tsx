import { Type } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  READING_FONTS,
  ReadingFontEnumValues,
  ensureAllReadingFontsLoaded,
  type ReadingFont,
} from "@/lib/readingFonts";
import { useReadingFont } from "../context/ReadingFontContext";

type FontPickerVariant = "menu-action" | "compact-menu-action";

interface FontPickerProps {
  className?: string;
  /**
   * `menu-action`: full-width row with label + description + icon — matches
   * the explanatory actions in the production account menu.
   *
   * `compact-menu-action` (default): compact row matching the surrounding
   * actions in `SidebarAccountMenu`.
   */
  variant?: FontPickerVariant;
  /** Called after a font is picked; popover menus use this to dismiss. */
  onAfterChange?: () => void;
}

const MENU_ACTION_DESCRIPTION = "Choose the typeface for the whole app.";

/**
 * Canonical reading-font picker. The chosen face is global — chrome, menus,
 * forms and prose all wear it (see the reading-style tokens in index.css).
 * Each option previews in its own face; webfonts load lazily when the list
 * opens. Both account-menu surfaces render through this component.
 */
export function FontPicker({ className, variant = "compact-menu-action", onAfterChange }: FontPickerProps) {
  const { font, setFont } = useReadingFont();

  function handleChange(value: string) {
    const next = ReadingFontEnumValues.find((id) => id === value);
    if (next) {
      setFont(next as ReadingFont);
      onAfterChange?.();
    }
  }

  const select = (
    <Select value={font} onValueChange={handleChange} onOpenChange={(open) => { if (open) ensureAllReadingFontsLoaded(); }}>
      <SelectTrigger
        size="sm"
        aria-label="Reading font"
        className="h-7 gap-1.5 rounded-md border-none bg-transparent px-2 text-xs font-medium shadow-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SelectValue data-font-preview={font} />
      </SelectTrigger>
      <SelectContent>
        {ReadingFontEnumValues.map((id) => (
          <SelectItem key={id} value={id} data-font-preview={id} className="text-sm">
            {READING_FONTS[id].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (variant === "menu-action") {
    return (
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60",
          className,
        )}
      >
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Type className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">Typeface</span>
          <span className="block text-xs text-muted-foreground">{MENU_ACTION_DESCRIPTION}</span>
        </span>
        <span className="mt-0.5 shrink-0">{select}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) px-2.5",
        className,
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <Type className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground">
        Typeface
      </span>
      {select}
    </div>
  );
}
