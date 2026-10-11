# Interaction rules

Moved verbatim from `DESIGN.md` (v0.3) on 2026-10-11 when `DESIGN.md` was rewritten for the pixel theme. These are product behaviours, not visual style, so they stay in force. Wherever a rule names a colour, shape or bubble style, the visual layer in `DESIGN.md` wins (square corners, token colours).

## Form and wizard footers

Keep **Save & exit** (or Cancel/Back) and the primary Continue/Connect/Finish
action in one shared footer row, vertically centered. Put the subdued secondary
action on the left and the primary action on the right. A step owns its whole
footer: do not render Save & exit in a separate parent block below it. Check this
alignment in every step and conditional state, not just the first screen.

Completed Slack setup is a success view: show the full agent avatar, success message,
and one centered Done action. Omit Save & exit after the connection has been
confirmed. The shared footer rule applies to its unfinished setup steps.

## Mobile navigation and text fields

The fixed bottom navigation uses an opaque surface so scrolling content cannot
show through its labels. On touch devices, editable controls use at least the
16px base typography token to prevent Safari's automatic focus zoom. Larger
title sizes remain larger.

The bottom navigation responds to accumulated scrolling, ignoring small
reversals and Safari's edge bounce. It glides out and eases back in with shared
motion tokens; the task composer follows the same motion. Keep page padding
stable while the navigation moves, and honor reduced-motion preferences.

Task conversations reveal their initial comments, interaction cards, plan, and
relevant run history together after positioning the latest message. Keep the
mobile loading surface at a stable viewport height while that history loads;
concealed content must not stretch the document. Background refreshes keep an
already revealed conversation and composer mounted and visible.
Bound the initial wait to 15 seconds. If a request stalls, reveal the available
conversation and composer with a notice that some history is still loading.

Only the viewer's own human comments sit on the right in blue bubbles. Agents
and other humans sit on the left on the page surface, with their own name and
avatar above the message. Human identity comes from the company directory;
missing photos use the shared initials fallback. Match ownership by the stored
author user ID and the authenticated viewer ID, never by display name or the bot
that relayed a message from another channel.

## Contextual feedback

Task chat shows execution errors and waits only while they remain relevant.
Completing or cancelling a task hides its old execution notices. A newer attempt by
the same agent or an explicit successor supersedes earlier run notices; an
unresolved execution hold remains visible. Historical turns keep their responses,
files, questions and inspectable activity without a Worked/Stopped status label.
Run history retains the full diagnostic record. Session reset boundaries remain
in the conversation. Time passing or a new human comment alone does not resolve
an error. Stored notices need run or recovery provenance before they can be hidden;
child-task relays and other unrelated system updates stay visible.

Credential-sharing denials stay expanded as an error card in the task conversation.
Name the agent and selected AI connection when known, and say which person lacks
access. Use “you” only for that person’s own run. Link to the agent’s AI connection
settings; retrying before changing the connection cannot repair a sharing denial.
Show the connection name to the affected user so they can identify what blocked
their task, and to viewers in the connection's human sharing audience. Other task
readers see a generic credential label. Never show credential secrets or grant IDs.
The same run-relevance rules hide the card after a newer attempt or terminal task.

Do not show a toast for task or run state already visible on the current screen.
This includes descendant runs represented by the open subtree. Show local action
results in place; keep failures actionable inline. Notifications for other work
remain useful. Repeated delivery of the same run outcome must refresh cached state
without repeating its toast, including after reconnecting. A terminal outcome
delivered more than five minutes after the run finished is historical and should
refresh state silently. Expected cancellation is neutral gray, not an error. The composer's Stop action stops the current response and leaves the composer available for a new message. Pause work is a separate explicit task or subtree action. A paused task replaces the composer with an amber takeover. It says “Task is
paused.” and “Resume this task to send a message.” with a “Resume task” action.
Subtrees use “Subtree is paused.” and “Resume subtree.” The takeover cannot be
dismissed, retains drafts, and hides message inputs until the pause is released.

Confirmations whose source work is still syncing show “Preparing approval…” and
disable acceptance until the server reports readiness. Refresh that state automatically;
rejection and revision remain available. Live tool reviews keep their own approval flow.

Pending questions, confirmations, and other task-thread inputs appear in a separate
card directly above the ordinary composer. The composer stays available for new
messages while the card is open. Questions use their compact history entry as the
reminder; dismissing one clears the composer and stays effective after reload for
that person and task. Other inputs keep a pending indicator that can reopen them;
resolving or skipping the input removes that indicator.

## Motion tokens (Task Chat Redesign)

Mobile task panels fill the viewport within the safe area. Their top toolbar shows the current tab title, an open-tab count and selector, an add action, and an X to return to the feed. The selector lists tabs vertically with wrapping titles, an explicit current-tab check, and visible close controls. Each touch control uses the 44px size token. Desktop tabs keep their horizontal layout. Document links within the current task open through the router and retain the feed's reading position and query cache.

The redesigned task thread (flag `enableTaskChatRedesign`) is the first surface to
tokenize motion. Principles — reasoning only; values live in `ui/src/index.css`:

- **One home, and it is `:root`, not `@theme inline`.** `@theme inline` bakes literals
  at build time, so a value placed there cannot be moved at runtime. The dev tweak panel
  tunes motion by writing CSS custom properties live, so every motion token must resolve
  at runtime — hence `:root`.
- **Two tiers.** Primitives (`--motion-duration-*`, `--motion-ease-*`) express the app's
  baseline motion feel; state/component-scoped tokens (`--motion-<state>-*`) reference the
  primitives so the whole thread retunes from a few knobs. Scoped tokens exist so the
  tweak panel can group controls by the state they affect.
- **Reuse the house curves.** New easing defaults point at the two curves already used
  across the app rather than inventing a third feel.
- **No hardcoded timing in components.** Durations, easings, delays, and staggers used by
  the redesigned thread must reference these tokens; a check script rejects raw `ms` /
  `cubic-bezier` values outside `ui/src/index.css`. This discipline is what makes the
  tweak panel structurally possible.
- **Values are placeholders.** The committed numbers are sensible starting points, tuned
  live by a human and pasted back from the tweak panel's export — never treated as final
  during the baseline build.
- **Reduced motion is honored at the token layer.** A `prefers-reduced-motion: reduce`
  block collapses the duration/stagger tokens to zero, cascading to every scoped token,
  in addition to each animation's own component-level guard.

Agent Chat and regular task chats keep pending questions as compact “Unanswered question” entries at their original position in history. Dismissing the form or sending a newer user message clears it from the composer without resolving it. Questions never contribute to composer pending counts or navigation. Opening the history entry restores the original form and its draft; submitting later uses the same durable question response path. Actual permission reviews retain their permission checks.
