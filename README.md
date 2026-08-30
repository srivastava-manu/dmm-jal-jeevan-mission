# Handoff: Digital Maturity Model — unified web app

## Overview

A single web application that lets **state IT officers** self-assess the digital maturity of their state's
IT systems under the Jal Jeevan Mission, and lets the **National Jal Jeevan Mission (Centre)** see the
consolidated national picture, manage state assessor accounts, and respond to support requests raised by states.

The assessment model has **48 capability areas across 8 layers**, each scored 0–4. A layer scores 0–24;
the overall assessment scores 0–192, which converts to a percentage and a named maturity band.

Both audiences share **one app and one login**. The user's `role` decides which surface they land on:

| role | lands on | scope |
|---|---|---|
| `state_assessor` | Assessment tool | Only their own state |
| `centre` | National dashboard | All states, submitted assessments only |

**Do not build two apps.** One codebase, one auth system, role-based routing after login.

---

## About the design files

The files in this bundle are **design references created in HTML** — prototypes that show the intended
look, layout and behaviour. They are **not production code to copy**. They carry hardcoded seed data,
run entirely in the browser, and persist to `localStorage`.

The task is to **recreate these designs in a real stack** with a database and authentication. If no
codebase exists yet, the recommended stack is at the end of this document.

## Fidelity

**High fidelity.** Colours, typography, spacing, copy and interaction behaviour are all final and should be
reproduced faithfully. Exact values are in *Design tokens* below.

---

## The model (content, not code)

`dmm-model.js` in this bundle is the authoritative content. **It must become database rows, not
hardcoded constants** — the 48 capabilities and their wording will keep changing after stakeholder
discussions, and each saved assessment must record which version it was taken against.

**Revised.** A model version now carries two descriptions, because it has two audiences.
`notes` is internal provenance ("Imported from dmm-model.js") and never leaves the server;
`public_notes` is written for state officials and is what the About page's version history
lists — a version with `public_notes` NULL is not listed at all. Publish a version only when it
changed what a score *means* (a capability added, retired or renamed; a measure reworded so the
same practice earns a different rating), and set `published_at` explicitly rather than letting
it default to migration time. The full rule, the wording guidance and the cross-environment
migration rules are in **`MODEL-VERSIONS.md`**.

It exports:

- `MODEL_VERSION` — e.g. `"v2.1"`
- `SCALE` — the five rating levels: `{n, short, t, d}`
- `BANDS` — the five maturity bands with their percentage ceilings
- `SCORE_COLORS` — the 0–4 colour ramp
- `LAYERS` — 8 layers, each `{name, covers, short, caps: [{n, m, inc}] }` where `n` = capability name,
  `m` = measure text (the question), `inc` = list of included functions
- `STATES` — all 28 states and 8 UTs, alphabetical

### The rating scale (verbatim)

| # | Label | Definition |
|---|---|---|
| 0 | Does not exist | No digital system for this capability. Handled on paper, in spreadsheets, or not at all. |
| 1 | Under development | A system has been sanctioned, procured or is in development. Nothing is in productive use yet. |
| 2 | Pilot complete | Live and working with real data in a limited setting — one or a few districts, or a small user group — for at least one full reporting cycle. Not yet rolled out further. |
| 3 | Functional at limited scale | In routine production use across part of the state by the intended users. Gaps remain — some districts still manual, or some workflow steps still offline. |
| 4 | Fully functional at state scale | In routine use across effectively all districts by effectively all intended users. The data is authoritative, no parallel manual register is maintained, and the system is owned and monitored. |

### Maturity bands (applied at layer and overall level, on percentage)

| Range | Band |
|---|---|
| 0–20% | Nascent |
| 21–40% | Emerging |
| 41–60% | Developing |
| 61–80% | Mature |
| 81–100% | Leading |

### The eight layers

1. **Citizens** — digital services reaching consumers and households directly
2. **Frontline Workers** — digital tools used by field staff for monitoring and reporting
3. **Agencies** — digital management of implementing and operating agencies
4. **Department** — digital systems for planning, finance, and governance at department level
5. **State Functionaries** — cross-department coordination and strategic decision-making
6. **Shared Digital Services** — services shared across all stakeholder groups
7. **Technology Foundation** — the software layer underlying every other layer
8. **Infrastructure Foundation** — the compute and network layer underlying the technology foundation

Every capability's measure text begins "Whether the State has the capability to…" or
"Whether the system has the capability to…". Keep that phrasing.

---

## Business rules (non-negotiable)

These are the rules the design encodes. Getting them wrong breaks the product's integrity.

1. **The Centre never sees a draft.** Every Centre query filters `status = 'submitted'`. An in-progress
   assessment is invisible to the Centre — not shown as partial, not counted.
2. **Averages exclude non-submitters entirely.** A state that has not submitted is *not* a zero. It is
   absent from the denominator.
3. **Submitted assessments lock after 7 days.** `locked_at = submitted_at + 7 days`. Score writes after
   that are rejected server-side, not just hidden in the UI.
4. **Submission requires all 48 answered.** A partial assessment distorts the index. The review screen
   lists what is missing and the submit button is disabled until it's empty.
5. **Evidence appears only on scores of 3 and 4.** When an assessor picks 3 or 4, an evidence block
   appears: system (dropdown from the state's own systems list), districts live, go-live month.
   Only the system name is effectively required; the rest is encouraged. Evidence carries forward
   to the next assessment.
   > **Revised.** Evidence is now the single link `scores.system_id`; districts-live and go-live
   > live on the **system**, not on each score, so correcting a system corrects it everywhere it is
   > cited (including submitted assessments) — a factual correction, logged to `audit_log`. The
   > separate `score_evidence` table is gone. A system cited by any score cannot be deleted
   > (foreign key + a 409 from the API); edit it instead. Dropping the score below 3 clears the link.
6. **One assessor per state at a time.** The assessor may change between rounds. A submitted assessment
   permanently stores the name and designation of whoever submitted it — reassigning the state does not
   rewrite history.
7. **Name and state are mandatory at sign-in.** No silent defaults.
8. **Each assessment stores its model version.** When comparing two assessments taken against different
   versions, compare only capabilities present in both; mark the rest as new or retired, never as movement.
9. **Assessments are dated snapshots, not one mutable record.** A new assessment can start blank or
   pre-filled from the previous one.
10. **Support requests are raised by the state from a capability scored 0 or 1**, and answered by the
    Centre with a status and a reply note. No assignment, no SLA.

---

## Data model

```
users
  id, email, name, designation, role ('state_assessor' | 'centre'),
  state_id (null for centre), active (bool), created_at

states
  id, name, is_ut (bool)

model_versions
  id, version ('v2.1'), published_at, notes, public_notes

capabilities
  id, model_version_id, layer_index (0-7), layer_name, layer_covers,
  order_in_layer (0-5), name, measure, includes (text[])

assessments
  id, state_id, assessor_user_id, model_version_id,
  status ('draft' | 'submitted'),
  assessor_name, assessor_designation,      -- snapshotted at submit
  created_at, submitted_at, locked_at
  -- at most one draft per state

scores
  id, assessment_id, capability_id, value (0-4 | null), note (text),
  system_id (-> systems, the evidence link; only set on scores of 3 or 4)

systems                                     -- a state's own systems, captured once
  id, state_id, name, districts_live (int), go_live (date), created_at, updated_at

support_requests                            -- named `requests` in the original spec
  id, state_id, capability_id, assessment_id, score_value,
  message (from state), status ('new' | 'in_progress' | 'closed'),
  reply (from centre), replied_by, created_at, updated_at

sessions                                    -- server-side sessions; the cookie holds only this id
  id, user_id, created_at, expires_at

audit_log                                   -- user-management actions and system edits
  id, actor_user_id, action, target_user_id, target_state_id, detail, created_at
```

### Derived values (compute, never store)

- `layer_score` = sum of that layer's 6 score values (0–24)
- `overall_score` = sum of all 48 (0–192); `overall_pct = round(overall/192*100)`
- `band(pct)` = first band whose ceiling ≥ pct
- **National capability average** = mean of that capability's value across submitted assessments
- **National layer average** = sum of that layer's 6 capability averages (out of 24)

---

## Screens — state assessor

### 1. Sign in
Two-column card, max-width 880px, centred, 16px radius, hairline border, `--shadow-sm`.
Left column (padding 44px 40px): 34px accent-green rounded square mark, h1 "Digital maturity /
self-assessment" at 30px/600/-0.02em, intro paragraph at 15px `--text-2` max 36ch, then the form —
**State / UT** select ("Select your state or UT", all 36 alphabetical), **Your name** (placeholder
"Required"), **Designation** (placeholder "e.g. State IT Officer"), all 42px tall / 6px radius.
Inline error in `--danger-fg` 12.5px above the button when state or name is missing.
Full-width green Continue button, 44px.
Right column on `--surface-2` with a left hairline: the five rating levels, each a 26px colour swatch
with the level number in mono, label 13px/600, definition 12px `--text-3`. Footer line:
"This assessment is for your state's own roadmap. It is not used for ranking or fund allocation."

### 2. Home / History
Max-width 1180px. h1 = state name at 28px/600. Subline "N saved assessments · Assessor: Name, Designation".
Green "Start assessment" / "Start another" button top right.

If a draft exists: a card with `--border-accent`, "IN PROGRESS" label in accent, the draft title,
a progress bar (max-width 420px), "N of 48 answered · X/192 so far", and a green
"Continue assessment" button.

Two-column grid (1fr / 320px):
- **Left** — "Saved assessments" list. Each row: a 52px rounded square showing the percentage in mono
  on the band colour, the date at 15px/600, a line "Band · X/192 · Assessor name", a Delete button
  (click once to arm, again within 4s to confirm), and a chevron. Clicking the row opens that
  snapshot's results read-only.
- **Right** — "Overall maturity over time" bar chart (one bar per assessment plus the live draft,
  120px tall, percentage above each bar, date below), and a "Your systems" card with a
  "Manage systems" button.

### 3. Start assessment
Max-width 760px. Two clickable option cards — **no Begin button; each card starts the assessment
directly**:
- "Start from <date of last assessment>" · tag "Recommended" · "All 48 answers pre-filled. Change only
  what has moved." · CTA line "Begin from <date> →" in accent
- "Start blank" · tag "Slower" · "Answer all 48 from scratch, layer by layer." · CTA "Begin blank
  assessment →"

Plus a dashed "Model version" note, a warning box if an existing draft would be replaced, and Cancel.

### 4. Assess (the main screen)
Three columns: **248px layer nav / flexible capability list / 288px score rail**. Both side columns
`position:sticky; top:60px; height:calc(100vh - 60px); overflow:auto`.

**Left nav** — "Layers" label with "N of 48" in mono, a progress bar, then 8 layer items. Each shows
"1 Citizens", "6/6" in mono, a status dot and either the band + score (complete), "In progress", or
"Not started". Active layer gets `--accent-soft` background and `--border-accent`. Footer:
"Model v2.1 · 48 capabilities · scale 0–4. Answers save as you go."

**Centre column** — "LAYER N OF 8" label, layer name at 24px/600, an "All 48 in a grid" button top
right. Then one card per capability (12px radius, 18px 20px padding):
- capability name 16px/600
- measure text 13px `--text-2`, max 62ch — **always visible, never collapsed**
- the `includes` list as small pills on `--surface-3`
- caption "Rate against the functions listed above, as they work today."
- the score row: **5 buttons in a 5-column grid**, each with the number in mono 15px and the short
  label at 10.5px. Selected button takes that level's colour as its background and border;
  unselected are `--surface` with `--border-strong`. The full definition is the `title` tooltip.
- **if score ≥ 3**: an evidence block on `--surface-2` — system select (with
  "+ Add a new system…" as the last option, opening the systems dialog and attaching the new system
  to this capability immediately), districts input, go-live input, and an "Add a new system" link.
- **if score ≤ 1**: a "Support available" box on `--info-bg` reading "Other states run this at level 4
  and their IT teams can be connected." with a single "Request support" button.
- a footer line above a hairline: "Scored N · <label>" and "Was N on <date>" (note: **"on", not "in"**)

Unanswered capabilities beyond the current focus render as dashed placeholder rows.
Bottom: previous-layer and next-layer buttons; on layer 8 the next button becomes "Review & submit →".

**Right rail**, three white boxes in this order — all three share the same anatomy: a big mono figure
with its denominator on one baseline, the band right-aligned in accent, a progress bar, and a note:
1. **Progress** — "34" + "of 48 answered", bar, "14 left across 3 layers"
2. **Score for this layer** — "10" + "of 24", band, bar, "4 of 6 answered — the index firms up as you
   complete the layer." (or "All six answered. Was 9/24 on 11 Feb 2026.")
3. **Overall score so far** — "96" + "of 192", band, bar, comparison to the previous round
Then the Scale reference, then a **large solid green "Review & submit" button** (46px, 15px/600) pinned
to the bottom.

### 5. Matrix / re-assessment mode
Max-width 1400px, grid + 320px rail. Eight rows of `150px repeat(6, 1fr)`; each cell shows the
capability name at 10.5px and the score in mono, background = the level colour, and a dark outline
if it changed since the last assessment. Rail shows the selected capability with its measure, the
5-button scale, the previous value and delta, and a "Next unreviewed" button. Keyboard: ↑↓ to move,
0–4 to score.

### 6. Review & submit
Max-width 760px. Progress bar + "46 of 48". Then, conditionally:
- **Unanswered** block on `--danger-bg`: count, the list (each row clicks through to that layer),
  and "A partial assessment distorts the index — answer these before submitting."
- **Evidence gaps** block on `--warning-bg`: "N high scores without a system named".
- **"Worth a second look"** block: internal consistency flags, e.g. "Water Service Intelligence is 4
  but Data Infrastructure is 1." Not blocking.
- **On submit** dashed box: "Thank you <name> for completing the assessment! Once submitted, you can
  edit the score for the next 7 days. After 7 days, the scores will be locked."
Buttons: "Keep editing" and "Submit assessment" (grey and inert while anything is unanswered).

### 7. Executive summary (results)
Max-width 1240px, content + 300px sidebar. Order matters:
1. Header — state name 27px, meta line "<date> · assessed by <name>" (**no model version**)
2. Three cards: **Overall digital maturity** (band at 30px in accent, "96 of 192 · 50%", a bar;
   content distributed with `justify-content:space-between`) · **Since <date>** (band transition,
   "+23 points · 14 improved, 2 slipped", a "See what changed" button — hidden when there is no
   earlier round) · **Layers** (strongest / most room to grow)
3. **Layer-wise maturity index** — 8 rows, each: name (190px), bar, score in mono, band
4. **Strengths** (card with `--border-accent`, accent label) and **Where to focus next**, side by side.
   Strengths lists the four highest-scoring capabilities and a line naming the strongest layer;
   Focus lists the four lowest with "A starting point for the roadmap, prepared offline by your team."
5. A print-only full labelled maturity grid (page 2 of the PDF)

Sidebar: a mini 6-column grid of all 48 cells, an "Open full dashboard" button, and an **Export PDF**
button with the caption "Two A4 pages: executive summary, then the full labelled maturity grid."

**There is no peer-comparison block on this screen.**

### 8. Dashboard
Max-width 1400px, grid + 300px detail rail. Title "48 capabilities across 8 layers", then — directly
below the title — a **single-line legend card** listing all five levels with their full labels, then
the 8×6 grid (`150px repeat(6,1fr)`, cells 64px min-height, level colour, name at 10.5px, score in
mono). Cells are clickable.

Rail: the selected capability — layer and index, name, score swatch + label, measure text, an
Evidence box ("System · N districts · live YYYY-MM" or "No system attached yet."), score history
across rounds, and at the bottom, below a divider, an **Export PDF** button (dashboard only).
Empty state: "Select any cell to see the capability, what it measures, your score, the evidence
attached and how it has moved across rounds."

### 9. Compare
Max-width 900px. Overall band transition, "73 → 96 · +23 points", three chips (Improved / Same /
Slipped), a "Biggest moves" list (name, layer, "1 → 4", "▲ 3" in accent or "▼ 1" in danger), and a
"Not comparable" note explaining that capabilities added or reworded since the last version are shown
as new, never as an improvement.

### 10. About the model — **public, no sign-in required**
Max-width 900px. Reachable at `#about` without an account; a visitor sees only the About tab (no state
pill, no other nav) plus a "Start the assessment" prompt. Order:
1. Title "Digital Maturity Model" (no version number) + intro
2. **The eight layers** — one row per layer: `184px / 1fr` grid, layer number + name at 14px/600 with
   its "covers" line beneath, and its six capability names as pills
3. **Rating scale** — all five levels with 30px swatches and full definitions, plus a note that levels
   3 and 4 depend on routine *use*, not deployment
4. **Maturity index** — the five bands, each with a colour swatch — and **Version history**

### 11. Systems dialog
Modal, max-width 620px, 16px radius. Lists the state's systems (name, districts, go-live) and a row of
inputs + Add. When opened from a capability's evidence block, the hint changes to
"New systems are added to your list and attached to <capability> straight away."

---

## Screens — Centre (NJJM)

Top bar reads "Digital Maturity · Centre / National Jal Jeevan Mission" with three tabs —
**Dashboard**, **State assessors**, **Requests**.

> **Revised.** The top bar originally carried a pill "N of M submitted". It was removed: with
> M as the count of all states/UTs (36) it read as a contradiction next to the Submitted card's
> "of M states with an assessor" (26), because neither denominator was labelled. The counts now
> live only on the dashboard KPI cards, where each denominator is spelled out. Removing it also
> stops the national aggregation running on every Centre page just to render the pill.

### 12. National dashboard
Max-width 1560px, `1fr / 360px` grid; the rail is sticky at `top:80px`.
Below 1200px the layout collapses to one column with the rail beneath. The grid sits inside a
horizontal-scroll container with a **760px min-width floor** so cells never shrink to letter-stacks.

Meta line: "Averaged across N submitted assessments · M states and UTs have an assessor. Drafts are
not visible to the Centre and are excluded from all averages."

Five KPI cards: **National maturity** (band + "X of 192 · N%") · **Assessor coverage** ("of M states
and UTs have an assessor") · **Submitted** ("of M states with an assessor") · **Weakest layer** (layer
name, with its score as the subtitle — *not* prefixed with its index) · **Open requests** (with "N new").

The cards read as a chain — **36 states and UTs → 26 have an assessor → 20 submitted** — so every
denominator is labelled and none can be mistaken for another. The gap between total and covered is
deliberately visible: states with no assessor at all are a programme signal, not something to hide.

> **Revised.** Originally four cards, without **Assessor coverage**; that number appeared only in
> the meta line and (with a different denominator) in the removed top-bar pill.

**National maturity grid** — the 8×6 grid with each cell showing the capability name and its **mean
score to one decimal** across submitted states, coloured by the rounded mean. Header caption: "Each
cell is the mean score across submitted states · click one to see its distribution below".
Selected cell gets a dark border plus a `0 0 0 3px rgba(31,138,91,.28)` ring; clicking it again clears.
A wrapping legend card sits above the grid.

**Layer-wise national average** — 8 rows, labelled "sum of its six capability means, out of 24".

**Sticky rail** — when a cell is selected: the layer name as label, capability name as title, the
average swatch with "National average across N states", and the measure text. Then the distribution:
five rows, one per level, each with a swatch, label, count and a caret. **Clicking a level row expands
it** to the named states at that level as chips; clicking a chip opens that state's full assessment.
One level open at a time. With no capability selected, the rail shows the all-capability distribution
and the levels expand to states whose most common score is that level.

### 13. State assessors (user management)
Max-width 1240px. Table with columns **State / UT · Assessor (name + email) · Last submitted · Access ·
(action)** at `1.1fr 1.5fr 132px 116px 92px`. Access is a clickable pill toggling Active/Disabled.
The action is "Reassign", opening the dialog. Top-right button "Add a state assessor".
Subline: "One assessor per state. Reassign when the officer changes — past assessments keep the name of
whoever submitted them."

Dialog (max-width 520px): State/UT select, Name (required), Designation, Email (required), with inline
validation. Adding a state that already has an assessor is refused with "…already has an assessor. Use
Reassign instead."

### 14. Requests
Max-width 1240px, `1fr / 380px`, rail sticky (collapses below 1200px). Status filter chips with counts
(All / New / In progress / Closed). Each request card: the score swatch, capability name, a status pill
(New = `--danger-bg`, In progress = `--warning-bg`, Closed = `--surface-3`), a meta line
"State · Layer · raised <date>", and the state's note.

Rail: the selected request — meta, capability name, score swatch + label, "What the state said" box,
a national line ("N of M states are at 3 or above on this capability."), a three-button status setter,
a reply textarea, and a "Save reply" button.

### 15. State detail (read-only)
Reached from a chip in the dashboard rail. Header: state name, "Submitted <date> · <assessor>,
<designation>", and the total + band right-aligned. Then that state's full 8×6 grid, non-interactive.

---

## Interactions & behaviour

- **Routing** — hash-based in the prototype: `#about`, `#history`, `#assess`, `#matrix`, `#review`,
  `#results`, `#dashboard`, `#compare`. In production use real paths. `#about` must resolve
  without authentication.
- **Autosave** — every score change saves immediately; the top bar shows "Saved just now".
- **Transitions** — colour/tap 120ms, hover 180ms, panels 240ms, drawers 360ms, all on
  `cubic-bezier(.2,.7,.2,1)`.
- **Hover** — buttons darken to `--accent-hover`; ghost controls gain `--surface-3`; rows gain
  `--surface-2`; grid cells go to `opacity:.82` and lift 1px.
- **Press** — `transform: scale(.985)`.
- **Focus** — a 3px accent ring on every focusable control.
- **Toast** — bottom-centre, `--slate-900` background, white text, 10px radius, auto-dismiss 2.6s.
- **Delete confirmation** — two-step arm/confirm with a 4-second window, never a modal.
- **Print** — `@page A4 portrait, margin 12mm`. On the results page the sidebar is dropped, the layout
  becomes one column, and the labelled maturity grid is forced onto page 2. On the dashboard only the
  grid, legend and a meta line print.
- **Responsive** — below 1200px the Centre's two-column screens collapse to one column; both maturity
  grids keep a 760px floor and scroll horizontally.

## State

Per assessor session: current screen, current layer index, selected capability, draft scores (48),
evidence per capability, the systems list, toast text, sign-in validation error.
Per Centre session: current screen, selected grid cell, which distribution level is expanded,
selected request, status filter, reply draft, dialog form + its validation error.

---

## Design tokens

From the **GramVikas** design system (`_ds/p-rd-96eccd64.../tokens/`). Use the CSS variables, not the
literals, wherever the design system is available.

### Colour
| Token | Value | Use |
|---|---|---|
| `--accent` | `#1f8a5b` | the single brand hue — links, primary buttons, active nav, focus, "good" |
| `--accent-hover` | darker green | button hover |
| `--accent-soft` | pale green | active nav pill, Strengths card |
| `--border-accent` | green hairline | selected/active card border |
| `--bg` | `#f1f5f7` | app canvas |
| `--surface` | `#ffffff` | cards |
| `--surface-2` / `--surface-3` | slate tints | insets, hover fills, pills |
| `--border` / `--border-strong` | slate hairlines | dividers, inputs |
| `--text` / `--text-2` / `--text-3` | ink ramp | body / secondary / muted |
| `--danger-bg` / `--danger-fg` / `--danger-solid` | clay red `#c83a2b` | unanswered, slipped, New |
| `--warning-bg` / `--warning-fg` | amber `#d99404` | evidence gaps, In progress |
| `--info-bg` / `--info-fg` / `--info-solid` | teal `#0d7a8a` | support-available box |
| `--overlay` | rgba slate 45–55% | modal scrim |
| `--slate-900` | near-black | toast |

### Rating ramp (the one place colour is data)
| Score | Background | Foreground |
|---|---|---|
| 0 | `#DE9D9B` | `#5c2320` |
| 1 | `#ECB576` | `#5f3a10` |
| 2 | `#FBE6A2` | `#5f4c0a` |
| 3 | `#DCE9D5` | `#33502a` |
| 4 | `#58A65C` | `#ffffff` |

Unanswered = white background, `#8794a0` text. The same ramp colours the maturity bands on the
About page. Legend caption: "red → green = higher maturity".

### Type
**IBM Plex Sans** for all UI; **IBM Plex Mono** for every figure, with `tabular-nums`.
Weights 300/400/500/600/700.

| Role | Size / weight / tracking |
|---|---|
| Page h1 | 27–30px / 600 / −0.02em |
| Section h1 | 24–25px / 600 / −0.02em |
| Card title | 15–17px / 600 / −0.01em |
| Body | 13–14px / 400 / 1.5 |
| Secondary | 12.5–13px / `--text-2` |
| Uppercase label | 12px / 600 / +0.04em / `--text-3` |
| Big figure (mono) | 26–34px / 600 / −0.02em |
| Small figure (mono) | 11–14px |
| Grid cell name | 10.5px / 1.2 |

### Spacing, radius, elevation
8px base (2/4/8/12/16/20/24/32/40/48/64/80). Top bar 60px; assess nav 248px; assess rail 288px;
Centre rail 360px; requests rail 380px. Cards pad 18–24px.
Radius: 5–7px swatches and small controls, 8px buttons, 9–12px cards, 16px modals, 9999px pills.
Shadows soft and cool-slate — `--shadow-sm` on cards, `0 8px 28px rgba(20,26,31,.28)` on the toast.
Sticky bars use `backdrop-filter: saturate(180%) blur(16px)` over 86% white.

---

## Copy rules

Sentence case everywhere; UPPERCASE only for the small eyebrow labels. Indian numbering and
`DD MMM YYYY` dates. No emoji. Plain, factual, service-oriented — the tone of a competent public
institution. Say "on <date>", never "in <date>". Prefer "Where to focus next" over "weakest".
Always show strengths alongside gaps.

---

## Stack and deployment target

**Plain PostgreSQL on Indian government (NIC) infrastructure.** Not Supabase, not Firebase, not any
managed backend — the app must run against a standard Postgres endpoint given only a `DATABASE_URL`.

- **Front end** — React (Vite). The prototypes are plain DOM plus inline styles, so the port is mechanical.
- **API** — Node + Express, same repo.
- **Database** — PostgreSQL. Schema changes as numbered plain-SQL migration files in `migrations/`,
  checked into the repo; NIC will want to see exactly what runs against their database.
- **Config** — everything from environment variables. Assume NIC provides a database endpoint, not
  admin access. Keep anything NIC-specific in config so moving from a development database to theirs
  is a `DATABASE_URL` change, not a rewrite.

### Architecture requirements

1. **The browser never connects to Postgres.** All data access goes through the Express API.
2. **All SQL lives in one module** — `server/db/` — as scoped functions like `getAssessment(user, id)`.
   Route handlers never write SQL directly. This single module is what makes the data-isolation rules
   reviewable in one place.
3. **Use Postgres row-level security.** RLS is a Postgres feature, not a hosted-platform one, and it is
   the primary isolation guarantee: a state assessor must be unable to read another state's rows *even
   if the API code is wrong*.

### Row-level security pattern

Per request, open a transaction and set session variables, then let the policies read them:

```sql
BEGIN;
SET LOCAL app.user_id = '<uuid>';
SET LOCAL app.role    = 'state_assessor';
SET LOCAL app.state_id = '<uuid>';
-- ... queries ...
COMMIT;
```

Use a **transaction per request** so `SET LOCAL` cannot leak between pooled connections. This is the
single most important detail to get right when using RLS without a hosted platform.

Policy sketch:

- `assessments` — an assessor may `select` where `state_id = current_setting('app.state_id')::uuid`;
  may `insert`/`update` only where that matches **and** (`status = 'draft'` or `now() < locked_at`).
  The `centre` role may `select` only where `status = 'submitted'`.
- `scores` — inherit the same rules through `assessment_id`.
- `systems` — scoped to the owning state; `centre` reads only (state detail and the export).
- `support_requests` — an assessor sees and creates only their own state's; `centre` sees all and is
  the only role permitted to write `status` and `reply`.
- `audit_log` — `centre` reads and writes; a state assessor may only insert (its own system edits).
- `sessions` — no policy and no grant at all: the app role cannot touch the table directly. Its whole
  lifecycle goes through `SECURITY DEFINER` functions, so even SQL injection reaching
  `SELECT * FROM sessions` returns nothing.
- `capabilities`, `model_versions`, `states` — readable by all authenticated users.

Enforce the 7-day lock in **both** places: the API rejects the write with a clear error, and the RLS
policy refuses it regardless.

### Authentication

**Ask NIC first whether Parichay (government SSO) or eSignet integration is mandatory.** For an official
JJM system it probably is, and that decision is far cheaper made now than retrofitted.

For a self-hosted pilot: argon2 password hashing, httpOnly + secure session cookies, sessions stored in
Postgres. **No tokens in localStorage.** Structure the auth layer so an SSO provider can be swapped in
without touching the rest of the app.

### Build order

1. Migrations for `users` and `states`; session-based auth; the RLS session-variable plumbing;
   role-based redirect after login. **Include a test proving one state's assessor cannot read another
   state's rows.**
2. Seed `model_versions` and `capabilities` from `dmm-model.js`
3. State assessment flow — layer nav, scoring, autosave, evidence
4. Review + submit + the 7-day lock (API and RLS)
5. Results: executive summary, dashboard, compare, PDF export
6. Centre dashboard
7. User management
8. Requests

**Get one state assessor through end to end before building any Centre screen.** The Centre view has
nothing to show until real submissions exist.

### Open questions for NIC

- Is Parichay / eSignet SSO integration required?
- What PostgreSQL version do they run?
- Is there a data-localisation or audit requirement beyond what's above?

---

## Files in this bundle

| File | What it is |
|---|---|
| `dmm-model.js` | **The model content.** 48 capabilities with measures and includes lists, the 0–4 scale, bands, colour ramp, all 36 states and UTs. Becomes database rows. |
| `DMM Prototype.html` | State assessor prototype — every screen, fully interactive, seeded with three rounds of history. |
| `NJJM Centre.html` | Centre prototype — national dashboard, user management, requests, state detail. |
| `njjm-centre-data.js` | Seed data for the Centre prototype: 24 states with plausible scores built from per-capability national baselines, and six support requests. Reference only — not production data. |

Open either HTML file directly in a browser; both are self-contained and work offline. State persists
in `localStorage`, so clearing site data resets them.

No image or icon assets are used. Icons in the design system are Lucide; the prototypes use text and
colour only.
