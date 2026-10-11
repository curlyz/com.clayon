# Character bible

Status: draft, 2026-10-11. Owner: design. Governs every crew character in the pixel lab theme (`DESIGN.md`). All characters are original; none resembles a character from any film or game.

A character is an agent made visible. Each has a silhouette you can read at 32 pixels, one signature tool, a way of moving, and a voice. Status shows through mood and motion, never through a different character.

## Roster

| callsign | what it is | agent archetype | signature tool | moves by | silhouette key |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Doc | human scientist, patched jumpsuit, goggles, ponytail | lead, plans and reviews | clipboard and pencil | walks | upright, ponytail, rectangle clipboard |
| Quartz | crystalline alien | coder, precise and brittle | wrench | stiff walk | jagged top, faceted limbs |
| Legs | many-legged green alien | scout, fast and busy | wrench in a claw | scuttles | wide low body, antennae with orange tips |
| Orb | floating drone, white shell, blue eyes | monitor, always on | scanner | hovers | round, thruster flame beneath |
| Spore | tall fungus alien with a cap | researcher, slow thinker | small torch | glides | huge cap, long thin body |
| Shell | turtle-like alien | ops, steady and safe | screwdriver | slow walk | big shell, low head |
| Ribbon | ribbon-like spirit alien | messenger, fluid | soldering pen | floats and sways | long curling tail, thin top |
| Slate | rock-armoured alien | builder, heavy lifting | hammer | stomps | blocky, huge hands |

Roles are suggestions; any agent may be assigned any character. A character keeps its look when its agent changes role.

## Per-character sheet (required before any animation work)

Each character gets one entry in `doc/design/characters/<callsign>.md` with:

1. Silhouette test: the shape filled solid black at 32 pixels must still be unique among the eight.
2. Palette: 4 to 6 named colours, one of them the identity colour. No colour is shared as the identity colour.
3. Turnaround: front, three-quarter, side, back at the same scale.
4. Proportions: height in pixels, head ratio, where the tool sits in the hand.
5. Personality in one line, and a voice rule (how it speaks in its short lines).
6. Motion language: how it walks, what it does when idle, how it shows each mood.
7. Ledge behaviour: where it likes to stand (dock, bottom, header) and whom it pals with.

## Animation spec (every character)

| item | rule |
| :-- | :-- |
| frame cell | 64 by 64 pixels native, transparent background, feet on the same ground row in every frame |
| scale | shown at whole multiples only (1x, 2x, 3x) |
| timing | 8 frames per second, held frames, no easing |
| facing | drawn facing right; the app mirrors for left |
| loops | walk 8 frames, idle 4, working 4, stalled 4, happy 4 |
| reactions | hover 2 frames, press 3 frames, plus a one-shot "arrive" (appear) 4 frames |
| total | about 33 frames per character, about 264 for the crew |

Non-walkers keep the same loop names: Orb and Ribbon "walk" is a hover-glide, Legs "walk" is a scuttle, so the app treats every character the same.

Mood to loop mapping: idle (mood 0), working (1), stalled (2), happy (3). `walking` selects the walk loop and `facing` mirrors it.

## Pipeline

1. Design the sheet (this document plus `<callsign>.md`), including the silhouette test.
2. Generate the turnaround and animation strips with `codex exec` on terra, with the roster sheet attached as a reference and a flat magenta background for clean cut-outs. Record every image in `docs/superpowers/imagegen/index.html`.
3. Cut out: key out the magenta, slice by cell, check ground line and scale on a contact sheet. Reject frames that drift in size or palette and regenerate them.
4. Assemble: import the frames into one Rive file per character; wire the state machine and data-binding properties from `DESIGN.md`.
5. Verify in the app: every loop plays, mirroring works, a character is readable at 1x on a phone.

## Status (2026-10-11)

| callsign | turnaround | parts sheet | animation strips | rigged in Rive |
| :-- | :-- | :-- | :-- | :-- |
| Doc | done | done | walk, idle and working pilot (frames drift, see note) | no |
| Quartz | done | done | no | no |
| Legs | done | done | no | no |
| Orb | done | done | no | no |
| Spore | done | done | no | no |
| Shell | done | done | no | no |
| Ribbon | done | done | no | no |
| Slate | done | done | no | no |

Files live in `doc/design/characters/<callsign>/` as lossless webp with the magenta keyed to transparent. Note from the Doc pilot: generated animation frames drift in position and spacing, so animation is built by rigging the parts sheets in Rive, not by playing generated frames.

Before rigging, each parts sheet still needs a cleanup pass: slice into one image per part, trim, and pixel-snap on a shared grid. The silhouette test and per-character sheets from the section above are not written yet.

## Open questions

- Whether a human operator avatar joins the roster (a user-controlled character).
- Whether characters get small accessories that show an agent's tools or recent wins.
