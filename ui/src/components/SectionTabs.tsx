import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "@/lib/router";
import { cn } from "@/lib/utils";

export type SectionTabsItem = {
  id: string;
  label: string;
  group?: string;
  /**
   * Route destination. Present on any item switches the whole strip to
   * route-tab mode (NavLink owns the active state and `end` matching, no
   * scroll-spy); absent everywhere keeps the hash-anchor long-page mode.
   */
  to?: string;
  /** Route mode: exact path match, so nested sibling routes stay inactive. */
  end?: boolean;
  /** Quiet count beside the label (pending members, waiting reviews). */
  badge?: number;
};

type SectionTabsGroup = {
  label: string | undefined;
  items: SectionTabsItem[];
};

/** The element that actually scrolls, or null when the window scrolls. */
type ScrollElement = HTMLElement | null;

function groupSections(sections: SectionTabsItem[]): SectionTabsGroup[] {
  const groups: SectionTabsGroup[] = [];
  for (const section of sections) {
    const current = groups[groups.length - 1];
    if (current && current.label === section.group) {
      current.items.push(section);
    } else {
      groups.push({ label: section.group, items: [section] });
    }
  }
  return groups;
}

/**
 * The app scrolls inside the Layout `<main>` on desktop (`overflow-auto`)
 * and at the window on mobile — the strip must follow whichever ancestor
 * actually scrolls. Returns null when no ancestor scrolls (the window).
 */
function findScrollElement(element: HTMLElement): ScrollElement {
  let current: HTMLElement | null = element.parentElement;
  while (current !== null) {
    const overflowY = window.getComputedStyle(current).overflowY;
    const scrolls =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight;
    if (scrolls) return current;
    current = current.parentElement;
  }
  return null;
}

function scrollToTop(scrollElement: ScrollElement, top: number, behavior: ScrollBehavior) {
  if (scrollElement !== null) {
    scrollElement.scrollTo({ top, behavior });
  } else {
    window.scrollTo({ top, behavior });
  }
}

function isAtScrollFloor(scrollElement: ScrollElement) {
  if (scrollElement === null) {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  }
  return scrollElement.scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - 2;
}

/** The strip's top edge, measured in the scroller's scroll coordinates. */
function stripTopInScroller(strip: HTMLElement, scrollElement: ScrollElement): number {
  const stripTop = strip.getBoundingClientRect().top;
  if (scrollElement === null) return stripTop + window.scrollY;
  return stripTop - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop;
}

/** An element's top edge, measured in the scroller's scroll coordinates. */
function elementTopInScroller(element: HTMLElement, scrollElement: ScrollElement): number {
  const elementTop = element.getBoundingClientRect().top;
  if (scrollElement === null) return elementTop + window.scrollY;
  return elementTop - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop;
}

const tabClassBase = "relative inline-flex items-center whitespace-nowrap py-2.5 text-sm transition-colors";

/** One tab's visible content, shared by both modes: label, quiet count, underline. */
function TabContent({ section, active }: { section: SectionTabsItem; active: boolean }) {
  return (
    <>
      {section.label}
      {section.badge !== undefined && section.badge > 0 ? (
        <span className="ms-1.5 text-xs tabular-nums text-muted-foreground">
          {section.badge}
        </span>
      ) : null}
      {active ? (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ring" />
      ) : null}
    </>
  );
}

/**
 * Sticky section strip (leaf-node): plain-text group labels, the active
 * section underlined with `--ring`, one hairline under the whole strip, no
 * pills. Two modes over one strip: route-tab mode (any item carries `to`;
 * NavLink owns the active state and `end` matching) or hash-anchor mode for
 * a long scrolling page — clicking smooth-scrolls to the band
 * (reduced-motion aware) and scroll-spy keeps the active tab and
 * `location.hash` in sync through `history.replaceState` (no extra history
 * entries). On load an initial `#hash` scrolls to its section.
 */
export function SectionTabs({
  sections,
  ariaLabel,
}: {
  sections: SectionTabsItem[];
  ariaLabel: string;
}) {
  const routeMode = sections.some((section) => section.to !== undefined);
  const stripRef = useRef<HTMLElement | null>(null);
  const activeIdRef = useRef(sections[0]?.id ?? "");
  const [spyActiveId, setSpyActiveId] = useState(activeIdRef.current);
  const groups = groupSections(sections);

  const scrollToSection = useCallback((id: string) => {
    const strip = stripRef.current;
    const target = document.getElementById(id);
    if (!strip || !target) return;
    const scrollElement = findScrollElement(strip);
    const top =
      elementTopInScroller(target, scrollElement) -
      stripTopInScroller(strip, scrollElement) -
      strip.offsetHeight -
      8;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToTop(scrollElement, Math.max(top, 0), prefersReducedMotion ? "auto" : "smooth");
    history.replaceState(null, "", `#${id}`);
  }, []);

  // Scroll-spy: the active section is the last band whose top passed the
  // strip; at the scroll floor the last section wins. Route-tab mode has no
  // bands to spy on — NavLink owns the active tab there.
  useEffect(() => {
    if (routeMode || sections.length === 0) return undefined;
    const strip = stripRef.current;
    if (!strip) return undefined;
    const scrollElement = findScrollElement(strip);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const offset = strip.getBoundingClientRect().bottom + 8;
      let current = sections[0].id;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= offset) {
          current = section.id;
        }
      }
      if (isAtScrollFloor(scrollElement)) current = sections[sections.length - 1].id;
      if (current !== activeIdRef.current) {
        activeIdRef.current = current;
        setSpyActiveId(current);
        history.replaceState(null, "", `#${current}`);
      }
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    if (scrollElement !== null) {
      scrollElement.addEventListener("scroll", onScroll, { passive: true });
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      if (scrollElement !== null) {
        scrollElement.removeEventListener("scroll", onScroll);
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    };
  }, [routeMode, sections]);

  // Initial `#hash` on load scrolls to its section (after first layout).
  useEffect(() => {
    if (routeMode) return undefined;
    const hash = window.location.hash.slice(1);
    if (hash && sections.some((section) => section.id === hash)) {
      const frame = requestAnimationFrame(() => scrollToSection(hash));
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [routeMode, sections, scrollToSection]);

  return (
    <nav
      ref={stripRef}
      aria-label={ariaLabel}
      className="sticky top-0 z-(--z-sticky) border-b border-border bg-background"
    >
      {/* Leaf-node: the strip is one band — the container takes gap only,
          group labels and tabs are leaves. */}
      <div className="flex items-center gap-4 overflow-x-auto">
        {groups.map((group) => (
          <div key={group.label ?? group.items[0].id} className="flex items-center gap-3">
            {group.label ? (
              <span className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                {group.label}
              </span>
            ) : null}
            {group.items.map((section) =>
              routeMode && section.to !== undefined ? (
                <NavLink
                  key={section.id}
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    cn(
                      tabClassBase,
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => <TabContent section={section} active={isActive} />}
                </NavLink>
              ) : (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={spyActiveId === section.id ? "true" : undefined}
                  className={cn(
                    tabClassBase,
                    spyActiveId === section.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToSection(section.id);
                  }}
                >
                  <TabContent section={section} active={spyActiveId === section.id} />
                </a>
              ),
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
