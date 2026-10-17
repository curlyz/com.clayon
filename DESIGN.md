---
id: antl:clayon/DESIGN
---

# Design: pixel lab

**Status:** v1.0 draft, 2026-10-11. Replaces v0.3, the zero-visual-change simplification brief. Deliberate break: the product gets a new identity. Product name still open; working label "the lab".

Product behaviour rules (form footers, mobile navigation, task chat, feedback, motion tokens) are unchanged by this document; this file owns how the product looks and feels.

## What this document is for

Agents and humans changing `ui/`: this file is the source of truth for visual design. On conflict, change this file first or change the code. Storybook documents the system; it does not define it.

## Locked decisions (operator, 2026-10-11)

- **1. Pixel art.** — Every character, scene and emblem is crisp pixel art. No smoothed or photographic imagery in chrome.
- **2. Rive, with pixel characters.** — Every character is a `.riv` file that reacts to the user. Pixel look, live behaviour.
- **3. Inspired by Project Hail Mary.** — A cramped, practical, warm science ship. Original designs only; nothing from the film is reproduced.
- **4. No pills, no rounded boxes.** — Every corner is square. Radius tokens are `0`.

## Product stance

Clayon is an operational control plane: org charts, tasks, heartbeat runs, budgets, approvals, audit logs. The operator scans state and decides. Every screen answers, in order: *what is happening, does it need me, what do I do about it.* Density comes from information, never chrome. The theme is a skin on that stance, not a replacement.

## The look: a warm, cramped science ship

From published production notes on the film (soft and hard materials mixed, a deliberately small cockpit, warm analog colour, instruments not perfectly symmetric). Borrow the feeling, not the designs.

1. **Warm and analog.** Dark brown-black surfaces, cream paper, one amber accent, a burnt orange for warnings. No cold blue-black void.
2. **Cramped on purpose.** Tight rows and small gaps. The hero is a small viewport, never a sprawling banner.
3. **Soft beside hard.** Hard pixel panels sit next to paper-like notes. Notes appear in empty states and the hero, never behind working data.
4. **Slightly uneven.** Dials, bars and tick marks may vary a little from a perfect grid, as real instruments do. Never in text or table alignment.
5. **Handmade, not slick.** Characters read as physical puppets with a few frames of motion, not smooth vector animation.
6. **Original only.** No characters, ships, logos, names or screen designs from the film. Our crew is invented.

## Shape law: square

- No pills, no rounded boxes, no circles. Every button, input, badge, dock, popover, dialog, tile and avatar has square corners.
- Radius tokens (`--radius`, `--radius-*`) resolve to `0`. A component never sets its own radius.
- The bottom dock is a square-cornered strip with a hard 2px border and an offset shadow, not a floating capsule.
- Status badges are coloured text (as today), never a filled shape.
- Avatars are square pixel tiles. Circular crops are not allowed.

## Pixel law

- Pixel art is for imagery: characters, heroes, empty states, emblems. UI text keeps the readable mono face from the token layer; we do not set interface text in a pixel font.
- Render with `image-rendering: pixelated`. Scale by whole numbers only (1x, 2x, 3x). Never smooth, blur or rotate pixel art.
- Source art is stored at its native pixel size as `.webp` (lossless for sprites). Sheets are cut on a fixed grid, one cell per character.
- Hard 2px borders and hard offset shadows (no blur) are the only depth devices.
- The art is generated through `codex exec` on the terra model and converted to webp.

## Characters and Rive

Every agent is a character. A character is one `.riv` file plus a still sprite.

```text
[11]{part,rule}:
  file,"`ui/src/assets/characters/<callsign>.riv`, with `<callsign>.webp` as the still fallback"
  artboard,"one square artboard, transparent background, pixel-snapped"
  state machine,named `main`
  data,"data binding, not legacy state-machine inputs (Rive marks the \"Input Change\" listener action deprecated; read 2026-10-11, rive.app/docs/editor/state-machine/listeners). One view model per file with `mood` number (0 idle, 1 working, 2 stalled, 3 happy), `hover` boolean, `press` trigger"
  pointer,"Rive listeners (pointer enter, exit, down, up, click) on a hit-area shape handle hover and press inside the file; the app additionally writes `lookX` and `lookY` each frame (see Character events)"
  mood source,"derived from the agent's real status: running = 1, paused or blocked = 2, just completed = 3, otherwise 0"
  runtime,"`useRive` with `autoBind: true` and the `main` state machine (react runtime docs, read 2026-10-11); renderer package chosen per rive.app \"Choose a renderer\"; the canvas parent has a fixed width and height; one canvas per visible character; pause when off screen; show the still sprite until the file loads or if it fails"
  motion,"steps only (a few frames), never eased. Honour `prefers-reduced-motion` by showing the still sprite"
  sound,"off by default. When on: soft, low tones only"
  authoring,`.riv` files are authored in the Rive editor. Neither Codex nor this repo generates them
```

No `.riv` yet: still sprite with a CSS hover lift as stand-in. A missing `.riv` never blocks a screen.

Cast rules:
- Original characters only, drawn as a crew: one human scientist and a set of invented alien engineers with clearly different silhouettes.
- A character's colour is identity, not status. Status is shown by mood and by status text.
- Words never cover a character. Speech and labels sit beside or below.

## Crew overlay: the characters live on the screen (operator, 2026-10-11)

"i want all the characters to be animated, and running around the screen, in the bottom, in top nav, on top of bottom dock."

One fixed layer, mounted once at the app root, holds every character. It never takes part in layout.

```text
[11]{rule,detail}:
  layer,"`position: fixed; inset: 0`, `pointer-events: none`, one `--z-crew` step above content and below dialogs. Only each sprite's own hit area takes pointer events"
  ledges,"characters walk only along defined ledges: the top edge of the bottom dock, the bottom edge of the viewport, and the lower edge of the page header band. A ledge is a horizontal line plus a range; characters never cross content"
  movement,"the app moves the sprite with `transform: translate` in whole pixels. Rive plays the walk, idle and reaction loops in place. Movement never lives inside the `.riv` file"
  walk state,"extra view model properties: `walking` boolean and `facing` number (-1 left, 1 right). `mood` still tells working, stalled and happy"
  behaviour,"a character wanders along its ledge, pauses, and reacts when it meets another. A running agent stays near the dock; a stalled agent sits and sleeps; a happy one hops. Mood comes from real agent status, so the crowd reflects the work"
  interaction,"hover wakes it, click or tap talks (a short line beside it), drag lets the operator pick it up and drop it on another ledge. A click on a character opens that agent"
  never in the way,"characters never cover a button, input, text or table row. If the operator's pointer or focus reaches a control a character stands on, it steps aside. The layer is hidden in dialogs and while typing in the composer"
  budget,"at most 8 live canvases on desktop and 3 on phones. Off-screen or hidden-tab characters pause. More agents than slots share slots, and the rest show on the Crew page"
  reduced motion,"with `prefers-reduced-motion`, characters stop wandering and stand still on the dock"
  phone,only the dock-top and bottom ledges; no header ledge
  sound,"off by default; soft, low tones only"
```

Art needed beyond the character sheets: transparent per-character cut-outs, and for each character a walk loop, idle loop, working loop, stalled loop, happy loop, plus hover and press reactions. A character's frames share one pixel scale.

## Character events: mouse and AG-UI (operator, 2026-10-11)

"all the characters must be animated rive, with full support for mouse interaction and copilotkit agui events list"

Pattern from infinia's scene engine: a character's picture is a pure function of one **character state** and time. The app owns the state; Rive draws it. Rest state (no pointer, `mood` idle) is what reduced motion and print show.

### Rive view model (every character, one model)

```text
[10]{property,type,meaning}:
  `mood`,number,"0 idle, 1 working, 2 stalled, 3 happy"
  "`walking`, `facing`","boolean, number","movement; facing is -1 left, 1 right"
  `talking`,boolean,a text message is streaming
  `thinking`,boolean,reasoning is streaming
  `tool`,number,"0 none, otherwise the tool pose (1 signature tool, 2 reading, 3 typing, 4 scanning)"
  `progress`,number,"0 to 1, from the agent's todos"
  `waiting`,boolean,the agent is blocked on the operator (sign-off or question)
  "`hover`, `held`",boolean,pointer over; picked up
  "`lookX`, `lookY`",number,"-1 to 1, gaze toward the pointer"
  "`press`, `cheer`, `flinch`, `nod`, `arrive`",trigger,one-shot reactions
```

Properties bound through data binding (`autoBind: true`). The app writes them; pointer hit-testing and in-file reactions (enter, exit, down, up, click) run as Rive listeners. The app also forwards pointer position as `lookX` and `lookY`, throttled to one write per frame, so the gaze follows.

### Mouse and touch (full support)

```text
[7]{input,result}:
  move near,gaze follows the pointer
  hover,"wakes, `hover` on, a short line appears beside it"
  press and release,`press` reaction; click opens a short status line
  double click,the character's trick (`cheer`)
  drag,"`held` on, legs dangle, drop on another ledge"
  right click or long press,"square menu: open agent, send a message, pause, rest"
  keyboard,"every character is a button: focus wakes it, Enter opens the agent, Escape closes the line"
```

Touch matches: tap = click, long press = menu, drag = drag.

### AG-UI events to character

The app subscribes to the agent's AG-UI stream (CopilotKit `HttpAgent`) and maps each event for the run's agent. Event names are the AG-UI spec's; check the `@ag-ui/*` version in force in the ui package before wiring.

```text
[13]{AG-UI event,character reaction}:
  `RUN_STARTED`,"`arrive`, `mood` 1, walks to the dock"
  `RUN_FINISHED`,"`cheer`, `mood` 3 for 4 seconds, then 0"
  `RUN_ERROR`,"`flinch`, `mood` 2, sits and sleeps"
  `TEXT_MESSAGE_START` / `CONTENT` / `END`,`talking` on; the bubble streams the text; off at the end
  `TOOL_CALL_START`,"`tool` set from the tool name (signature tool, reading, typing, scanning)"
  `TOOL_CALL_ARGS`,a small pulse on the tool
  `TOOL_CALL_END`,`tool` 0
  `TOOL_CALL_RESULT`,`nod`
  `REASONING_START` / `CONTENT` / `END`,`thinking` on or off
  `STATE_SNAPSHOT` / `STATE_DELTA`,`progress` = completed todos over total todos
  `ACTIVITY_SNAPSHOT` / `DELTA`,"picks a micro-loop (reading, typing, scanning)"
  interrupt (human-in-the-loop),"`waiting` on, the character raises a hand, the dock badge counts it"
  "`MESSAGES_SNAPSHOT`, `RAW`, `CUSTOM`",no animation; logged only
```

Mood is derived, never stored: latest events plus the agent's real status. No live stream → falls back to API status.

## The token layer

Single token source: **`ui/src/index.css`** (Tailwind v4; tokens are CSS custom properties consumed via `@theme`). No parallel source such as `ui/src/tokens/`. Extracted values may live in a `tokens.css` imported by `index.css`.

Tailwind v4: `@theme inline` bakes literals at build time. Any token that must change at runtime (theme editor, dark overrides, motion) is defined in a non-inline block.

Palette roles (values authored in `ui/src/index.css`; component code never names a colour):

```text
[6]{role,feel}:
  surface ladder,"void, hull, band: three steps of dark brown-black"
  "ink, dim","cream text, muted tan text"
  line,"the hairline, drawn 2px, used for every divider and outline"
  accent,"amber, the one primary action colour"
  live,"a cool cyan, reserved for live agent activity"
  "ok, warn, bad","moss green, burnt orange, brick red"
```

One colour per meaning. Status maps to one token set used everywhere (badge, row, chart, log).

## Layout law (carried forward)

Clayon keeps Liquid Gold's leaf-node method. The pixel theme changes the skin, not the structure.

1. **Leaf-only padding.** Padding lives on leaf elements; containers get `gap`.
2. **Sections are bands split by one hairline token** (`--border`, 2px here). No grouping cards.
3. **Section headers are the title only**, plus a count and at most one trailing action. Header bands sit one step darker than the page.
4. **One header band per page.** Long pages with hash sections, "see more" for a dedicated page.
5. **Autosave everywhere.** No Save and Discard bars; status shows in place.
6. **Dock-only phone navigation**, with compact popovers and the first screen filling the phone.
7. **Tokens only.** No hex, raw px, arbitrary Tailwind brackets, or raw font-size in `ui/src/components/**` and `ui/src/pages/**`, outside the allowlist in `ui/src/index.css`. Combined classes use `cn()`.
8. **Grids where collections can tile**, made of leaf items, never wrapper cards.
9. **One z-scale** (`--z-*`).

## Words

One name per concept. The canonical term in data screens is *task*, *agent*, *run*, *budget*, *approval*. Navigation labels may use the lab vocabulary:

```text
[9]{plain term,nav label}:
  company,ship
  agents,crew
  tasks,experiments
  routines,protocols
  runs,lab notes
  budgets,rations
  approvals,sign-offs
  "apps, connectors",airlocks
  audit,lab notebook
```

Lab words appear in navigation labels, empty states and character lines only. Buttons name the action ("Approve hire", not "Submit"). Errors say what happened and what to do. Empty states say what to do first. No emoji in the interface.

## Enforcement

- `bun run check:token-gates` stays the gate for hex, raw px, arbitrary values and raw font-size.
- Shape gate (not yet built): forbid `rounded-*` classes other than `rounded-none`, and any `border-radius` outside the token layer. Until it exists, review enforces the square law.
- `bun run --cwd ui typecheck` and `bun run build` pass.
- Browser proof on every changed surface, at 390 wide and at 1280 wide.
- `AGENTS.md` links here.

## Out of scope for this document

Server code, data contracts and behaviour rules are untouched by this redesign. Package names, the Docker image name and upstream sync are not renamed here; the product name is a separate decision.

## Draft references

Space, imhigh and Halo drafts are rejected directions, kept only for comparison.
