# H2ELIOS Spatial Intelligence — Design & Implementation Brief

> ## ⚠️ STALE — DO NOT IMPLEMENT FROM THIS DOCUMENT AS WRITTEN
>
> §0 and §6 of this brief are built on a **false reading of the codebase** and must be
> re-baselined before use. The author (Claude) read `style.css` with a truncated
> window, saw content end at line 2969, and assumed end-of-file. The file is **4,177
> lines**. Verified corrections:
>
> | Brief claims | Actual (verified 2026-08-10) |
> |---|---|
> | Three stacked `:root` blocks | **One**, at `style.css:6`. Line 2710: *"tokens are consolidated in :root"* |
> | Sidebar merge not yet started (Phase 4) | **Already built** — `#app-sidebar` at `index.html:73`, `#sidebar-toggle` at `index.html:47` |
> | `style.css` is the only stylesheet to consolidate | **`hud.css` loads AFTER it** (`index.html:27`) and still supplies scanlines (`hud.css:3`), Space Grotesk (`hud.css:21`), and cyan `#3fd6e8` (`hud.css:51`) |
> | Phase 1 gate: "no visual change" | Not achievable as stated. 64 `!important` across 32 blocks; ~16 legitimately must win (MapLibre remote CSS is uneditable, `.page[hidden]`, reduced-motion). Correct gate: **"no *undeclared* change against named reference states."** |
>
> Additional defects found by Codex in round 2 (see §9): the sidebar layer inventory in
> §2.2 omits manufacturing, fueling stations, supply-chain flows, the live API tier,
> and the dynamically-injected 3D-extrusion control, and lists a "Verified projects"
> control that does not exist; the §2.2 blue-filled sidebar selection contradicts the
> §3.5 / §7 requirement that both sliding indicators survive; the §7 criterion "no
> token defined twice" forbids legitimate theme and responsive overrides and should
> read "one base definition per semantic token, with enumerated contextual overrides."
>
> **Caution:** this repo lives in a OneDrive-synced folder. File contents changed
> mid-session while mtimes still read 2026-08-05. Re-verify current state before
> acting on any claim in this document.

**Status:** Stale — needs re-baseline against the current tree
**Date:** 2026-08-05
**Supersedes:** the ad-hoc "spatial UI refinement" and "macOS 26 component pass" retrofit layers currently at the end of `style.css`
**Review:** cross-model. Original direction proposed by Codex; audited and revised by
Claude; the five contested points below were then put back to Codex directly and
resolved by agreement (see §9).

---

## 0. Read this first: what is actually true today

A previous design proposal for this work described the codebase as if it were still
the original "tactical HUD / mission control" build. **It is not.** Before planning
anything, verify the following against the live app, because they materially change
what the work is:

| Claim you might assume | Actual current state |
|---|---|
| The app uses cyan `#3fd6e8` as its accent | **False.** `style.css:2953` sets `--cyan: var(--mac-accent)` where `--mac-accent: #0a84ff`. The app already renders literal macOS system blue. |
| The app uses Space Grotesk / Inter | **Half false.** `--font` (`style.css:78`) is already `-apple-system, BlinkMacSystemFont, "SF Pro Display"…`. Only `--font-head` still forces Space Grotesk, and `--font-mono` (Space Mono) is still misapplied to ordinary labels in ~20 places. |
| Panels use the old neon-outline treatment | **Mostly false.** Lines 2693–2927 already neutralize materials, remove scanlines, and quiet the borders. |
| This is a greenfield styling job | **False.** It is a *consolidation* job. |

### The actual problem

`style.css` is ~2,970 lines containing **three sequential design systems stacked on
top of each other**:

1. **Lines ~1–2690** — original tactical/HUD system. Neon glows, scanline textures,
   uppercase wide-tracked micro-labels, cyan everywhere, `Space Grotesk` headings,
   `Space Mono` for ordinary text.
2. **Lines 2693–2927** — "spatial UI refinement." Overrides #1's materials, radii,
   and text colors. Uses `!important` to win.
3. **Lines 2929–2969** — "macOS 26 component pass." Overrides #2's accent color and
   introduces a `--mac-*` token set that partially duplicates the `:root` tokens
   defined at the top of the file.

Every layer wins by being *later in the cascade*, not by being correct. The result:
tokens are defined 2–3 times with different values, `!important` is load-bearing,
and any new rule must be appended at the very bottom to have any effect. This is the
thing to fix. **Do not add a fourth layer.**

---

## 1. The direction

**H2ELIOS Spatial Intelligence** — a native Apple *spatial-intelligence application*,
not a website with glass effects applied. Reference points: Apple Maps, Weather, and
professional macOS research tools (Finder, Xcode) — with the globe as the primary
canvas.

Two layout modes:

- **Spatial Observatory** — for **Explore** (the map/globe workspace). The globe
  occupies nearly the entire window; navigation and controls float above it as quiet,
  translucent tools.
- **Research Studio** — for **Economics, Technology, Demand, Policy, Timeline,
  Organizations, Calculator**. A denser macOS productivity layout: permanent sidebar,
  central workspace, resizable right inspector, tables and charts given visual
  priority.

They share one shell — the same toolbar, sidebar, and inspector system. Only the
content region differs.

---

## 2. Decisions already made (do not re-litigate)

These three were explicitly decided by the project owner. Each was chosen as
"try it, and audit later if it doesn't feel right" — so implement them fully and
cleanly enough that reversing one later is a token change, not a rewrite.

### 2.1 Accent color: **literal macOS system blue**

`#0A84FF` is the interaction color. It is already the computed value; this brief
makes it *intentional* rather than an accident of cascade order.

- **System blue** = interaction only. Selection, focus, active states, primary
  buttons, sidebar selection, checked toggles.
- **Hydrogen taxonomy colors** = data only. Green/blue/pink/turquoise/gray/brown
  hydrogen, plus amber (construction) and red (risk). These are **never** used for
  interface chrome.
- **Cyan `#3fd6e8` is retired as an interface color.** It may survive only inside the
  globe's own data rendering if it encodes something real.

> **Reversibility requirement:** the accent must resolve from exactly one token.
> Changing `--accent` in one place must re-color the entire interface. If a later
> audit wants cyan back, that must be a one-line change.

### 2.2 Navigation: **merge into one collapsible sidebar**

Replace both `#tab-nav` (the top workspace pill) and `#layer-dock` (the left icon
rail) with a single collapsible left sidebar.

```
Workspaces
  Explore · Economics · Technology · Demand
  Policy · Timeline · Organizations · Calculator
Map layers            (Explore only — hidden/disabled elsewhere)
  Production · Storage · Pipelines · Hubs · Transport · Upstream · End use
Data                  (Explore only)
  IEA projects · Verified projects · Estimated locations
Filters               (Explore only)
  Status · Region · Color
```

- **Collapsed:** 52–60px, icons only, native tooltips, selected item gets a blue
  rounded-rect.
- **Expanded:** 240–280px, grouped sections with headers, icon + label + optional
  count/status, disclosure triangles for nested groups, filter field at top.
- Collapse state persists across sessions and across workspace navigation.

This is the highest-risk item in the brief — it removes two components that currently
work correctly. See §6 for the required sequencing.

### 2.3 Typography: **full Apple system stack**

Retire `--font-head` (Space Grotesk). Everything uses `--font` (the Apple system
stack, already defined at `style.css:78`).

`--font-mono` (Space Mono) survives **only** for: coordinates, IDs, timestamps, code,
and technically-aligned values where character alignment carries meaning. It must be
removed from headings, KPI values, labels, badges, and step indicators — roughly 20
current call sites.

Type roles (replace the current ad-hoc sizes):

| Role | Size / weight | Notes |
|---|---|---|
| Large title (workspace name) | 28–34px / 700 | tight tracking, **not** uppercase |
| Panel / card title | 15–17px / 600 | |
| Body | 13–14px / 400 | generous line-height |
| Label (field, section) | 12–13px / 500 | sentence case, normal tracking |
| Caption / metadata | 10–11px / 500 | reduced opacity |
| Data value | headline size, tabular figures | `font-variant-numeric: tabular-nums` |

**Explicitly kill:** uppercase + wide-tracking micro-labels, 9px text used across
whole panels, monospace for ordinary labels.

---

## 3. What must NOT change

Guardrails. Violating these means the work has gone wrong.

1. **The globe and its data rendering.** Spikes, arcs, clusters, day/night, layer
   visibility logic. The globe is the product.
2. **Hydrogen taxonomy colors.** `--h-green`, `--h-blue`, `--h-pink`,
   `--h-turquoise`, `--h-gray`, `--h-brown`, plus `--green-ok` / `--amber` for
   status. Semantics are load-bearing.
3. **All existing behavior and functionality.** Every layer toggle, filter, panel,
   calculator mode, drag-and-drop target, and command-palette action keeps working.
   This is a presentation-layer consolidation, not a feature change.
4. **`js/smoke-test.js` must not regress.** Two failures pre-exist on `master`
   (`layer dock has 13 buttons (found 12)`, `Reset view flies back to the initial
   center [15,20]`). Confirm the before/after set is identical via `git stash`. Any
   *new* failure blocks the change. If merging the sidebar legitimately invalidates a
   dock assertion, update that assertion deliberately and say so — don't let it
   silently pass.
5. **Recently-landed behavior** (do not regress; restyle only):
   - The custom `MapControlCluster` zoom +/−/home control (`js/01-core.js`) that
     replaced MapLibre's stock `NavigationControl`.
   - The sliding active-indicator on both the workspace nav and the map mode switch
     (`positionActiveIndicator` in `js/09-router.js`, `positionModeIndicator` in
     `js/08-analytics.js`).
   - Research/Markets mutual exclusivity (`closeAnalyticsPanel` /
     `closeMarketsPanel` in `js/08-analytics.js`).

---

## 4. Target design system

### 4.1 Token architecture — the core deliverable

Collapse the three competing token sets into **one** `:root` block at the top of
`style.css`. Every value below must be defined exactly once.

```
Accent          --accent, --accent-hover, --accent-pressed, --accent-subtle,
                --accent-selection, --focus-ring
Surfaces        --bg-window, --bg-elevated, --material-sidebar,
                --material-shelf, --material-panel
Text            --text-primary, --text-secondary, --text-tertiary
Lines           --separator, --separator-strong
Radii           --r-control (7–10), --r-panel (14–18), --r-window (20–24)
Shadows         --shadow-shelf, --shadow-panel, --shadow-window
Motion          --dur-hover, --dur-press, --dur-menu, --dur-inspector,
                --dur-workspace, --ease-spring, --ease-out
Data            --h-green … --h-brown, --green-ok, --amber, --red-risk (unchanged)
```

Recommended dark values:

| Token | Value |
|---|---|
| `--bg-window` | `#080B10` |
| `--bg-elevated` | `#10151D` |
| `--material-sidebar` | translucent `#161C25` |
| `--text-primary` | `#F5F5F7` |
| `--text-secondary` | `#A6ADB7` |
| `--text-tertiary` | `#69727F` |
| `--accent` | `#0A84FF` |
| `--separator` | white @ 8–12% |

**Success test:** deleting lines 2693–2969 entirely and having the app still look
correct. If it doesn't, the consolidation is incomplete.

### 4.2 Three material levels

- **Canvas** — no container. Globe, large headings, primary charts sit directly on
  the workspace.
- **Shelf** — toolbars, filter rows, segmented controls. Light blur, thin inner
  highlight, small shadow, 10–14px radius.
- **Panel** — inspectors, calculator groups, tables, significant charts. Stronger
  blur, 18–24px radius, subtle edge, broad shadow, **no glowing border**.

Anti-pattern to remove: every number and paragraph in its own glass card.

### 4.3 Components

**Unified title bar** (replaces the disconnected floating capsules):
- *Left:* H2ELIOS mark, sidebar toggle, current workspace title
- *Center:* contextual tools for the current workspace (changes per workspace)
- *Right:* search, command palette, data-freshness indicator, overflow menu

**Right inspector** — one contextual surface whose *content* changes. 360–420px,
resizable, translucent sidebar material, large title, compact metadata,
hairline-separated groups, sticky bottom actions, smooth content crossfade on
selection change.

> **Scope of the "one inspector" rule — read carefully.** It applies to *unrelated
> singleton panels* (`#analytics-panel`, `#regional-ai-panel`, `#markets-panel`),
> which are single-instance app state and should not each be their own floating
> window.
>
> It does **not** apply to project detail snapshots. The app has a deliberate
> multi-project comparison system (`MAX_SNAPSHOTS = 3`, `openSnapshots`,
> `enforceSnapshotCap`, and content-bearing mini-cards in `js/01-core.js` ~388–409)
> built specifically so you can open one project, minimize it, and open another to
> compare. **Collapsing that into a single content-swapping inspector is a functional
> regression, not a styling change.** Comparison stays a first-class feature
> alongside the inspector. Tabs inside one inspector are *not* an acceptable
> substitute — they preserve the records but destroy simultaneous comparison, which
> is the entire point.

**Buttons** — primary (system blue, white text, 28–32px compact / 36–40px prominent,
7–9px radius, no glow); secondary (gray translucent); borderless (no resting
background, hover reveals, blue when selected); destructive (red, only after intent
is clear).

**Segmented controls** — neutral trough, selected segment gets a solid fill. **Never
an underline and a filled background simultaneously.** Max ~5 segments. Applies to
Explore/Research/Markets, status filters, Chart/Table.

**Tables** — Finder-style. 34–40px rows, subtle separators, sticky headers, full-row
hover, blue selection, sort indicator in the header, right-aligned numbers,
left-aligned names, status as text + small symbol rather than glowing pills.
Selecting a row opens the inspector without navigating away.

**Forms (Calculator)** — macOS Settings-style grouped rows: label + optional subtitle
left, control/value right, hairline below, validation directly under the field, units
inside or adjacent.

**Sliders** — 4px track, white 15–17px thumb, blue fill, live value right-aligned,
keyboard arrows. Thumb tracks immediately; dependent charts interpolate 180–240ms.

**Search / command palette** — Spotlight behavior. Centered, 560–680px, results
grouped (Projects / Workspaces / Commands / Filters / Saved views), arrow-key
navigation, blue selection, Return opens, Escape closes.

**Charts** — Apple Health/Weather, not trading terminal. Clean axes, thin gridlines,
rounded joins, popover tooltips, selection synchronized to the inspector.

> **"Weather-style" means quiet chrome, not one series.** It refers to restrained
> grids, direct labeling, and clear interaction — *not* single-series cardinality.
> This app is genuinely multivariate: the break-even chart supports 6 concurrent
> country series by design (`js/11-market.js`), the LCOH sandbox runs multiple
> scenario lines, and the Markets panel embeds live TradingView.
>
> Rule: **all selected series stay equally legible at rest.** Emphasis-with-recede
> is a *hover / focus / explicit-selection* state, never a resting state. TradingView
> and genuinely multivariate analytical charts are exempt from the styling pass.

### 4.4 Motion

| Interaction | Duration |
|---|---|
| Hover | 120–160ms |
| Press | 80–120ms |
| Menu / popover | 160–220ms |
| Inspector slide | 260–340ms |
| Workspace transition | 280–420ms |
| Globe navigation | 700–1400ms by distance |

Spring easing for spatial movement, ease-out for opacity. Menus originate from their
trigger. Numbers interpolate rather than snapping. **No constant pulsing or glowing**
except genuinely live indicators.

### 4.5 Background

Original to H2ELIOS — **not** a copied Apple wallpaper. Concept: *hydrogen
atmosphere*. Near-black navy base, soft blue-green atmospheric scattering behind the
globe, one broad directional light, very faint particulate stars, almost-invisible
network texture. **No scanlines. No hexagon grid. No purple AI gradient.** Optional
aurora reacting to globe rotation, moving extremely slowly.

Non-map workspaces get a quieter version: dark graphite, one or two broad tinted
lighting fields, slight grain to prevent banding, no decorative blobs behind cards.

> Note: an aurora-over-black background was implemented and reverted once already
> (commits `5690ca2` / `da38063`) — the owner preferred the navy treatment. Treat
> that as a data point: keep it subtle, and expect background changes to need a
> visual check before they're kept.

---

## 5. Non-goals

- No new data sources, datasets, or analytical features.
- No changes to globe rendering or geospatial logic.
- No light mode in this pass. Structure tokens so it's *possible* later; don't build it.
- No mobile rebuild in this pass. Don't actively break responsive behavior.
- No logo-system redesign.
- **No aurora background in this pass.** Commits `5690ca2` / `da38063` are an explicit
  owner rejection of that treatment; it does not return without re-authorization.
- No framework migration. Vanilla CSS + classic scripts, as today.
- No new dependencies.

---

## 6. Sequencing

Each phase must land, verify, and be committed independently. **Do not begin a phase
until the previous one is verified in a real browser.**

**Phase 1 — Token consolidation (foundation, no visual change intended)**
Collapse the three `:root` blocks into one. Remove duplicate definitions. Eliminate
load-bearing `!important`. Delete the trailing override layers (2693–2969) by folding
their *intent* into the main rules. Target: app looks essentially identical, but
`style.css` has exactly one source of truth per token.
*Gate:* visual diff shows no unintended change; smoke-test failure set unchanged.

**Phase 2 — Typography pass**
Retire `--font-head`. Apply the §2.3 type roles. Strip `--font-mono` from all
non-technical uses. Remove uppercase wide-tracking labels.
*Gate:* no 9px body text remains; no monospace outside coordinates/IDs/timestamps.

**Phase 3 — Component pass**
Buttons, segmented controls, tables, forms, sliders, toggles, menus, notifications.
Fix the "underline + filled background simultaneously" conflict on the mode switch.
*Gate:* every control still functions; smoke-test failure set unchanged.

**Phase 4 — Shell restructure (highest risk)**
Unified title bar, then the merged sidebar, then the consolidated inspector.
Sub-sequence strictly:
  a. **Extract shared route/layer actions from DOM-specific selectors first.** Today
     the behavior is bound directly to markup — notably the Calculator drag-and-drop
     target, which binds to `.tab-btn[data-route="tools"]` in
     `wireCalculatorDropTarget` (`js/09-router.js:142`). Decouple before rebuilding,
     or the new sidebar silently drops it.
  b. Build the sidebar alongside the existing `#tab-nav` / `#layer-dock`, behind a
     startup flag. **Never mount two active navs with duplicate IDs.**
  c. Preserve the contracts: `data-route`, `data-layer`, flyout state, keyboard
     behavior, and the Calculator drop target.
  d. Verify all 8 routes, all layer controls, all 3 filter flyouts, responsive
     states, and the DnD target.
  e. Flip the default, *then* remove legacy markup and compatibility code.
*Gate:* all 8 routes navigate; all 13 layer toggles work; filters work; the
Technology→Calculator drag-and-drop still lands; recently-landed behavior from §3.5
intact.

**Phase 5 — Background and motion polish**
Hydrogen-atmosphere background, motion timing table, loading/empty/error states.
*Gate:* owner visual review — this is the most subjective phase.

---

## 7. Acceptance criteria

- [ ] Exactly one `:root` token block; no token defined twice with different values.
- [ ] Deleting the former override layers is a no-op (they no longer exist).
- [ ] `--accent` is the single source for every interaction color; changing it
      re-colors the entire interface.
- [ ] No hydrogen taxonomy color appears in interface chrome; no `--accent` appears
      in data encoding.
- [ ] `--font-head` is gone; `--font-mono` appears only on technical values.
- [ ] No uppercase wide-tracked micro-labels remain.
- [ ] All 8 workspace routes navigate correctly from the sidebar.
- [ ] All layer toggles, filters, and flyouts work from the sidebar.
- [ ] The zoom cluster, both sliding indicators, and Research/Markets exclusivity all
      still behave as they do today.
- [ ] Smoke-test failure set is byte-identical to the clean baseline. The criterion is
      **"no new failures relative to a clean baseline,"** not "zero failures."
      *Capture the baseline once to a file, or use a separate worktree — do **not**
      `git stash` a shared dirty tree to get it. This tree carries untracked work
      (`js/23-spatial-shell.js`, `js/24-geology-intelligence.js`), and stash-based
      baselining is both risky and not a clean comparison.*
- [ ] Zero new console errors on every route and on the interactions above.
      *(Note: `js/18-api-live.js` emits pre-existing `HTTP 404 live API fetch failed`
      errors on a background poll — that is a known, separate issue, not a regression.)*
- [ ] Verified in a real browser, not only by reading source.

---

## 8. Working agreement

- Work on `master`, committing per phase.
- Verify every visual change in a real browser before reporting it complete. Source
  review alone is not sufficient — a rendering artifact in an automation browser has
  already produced one false bug report in this project.
- When a change touches something the owner explicitly approved earlier, flag it
  rather than silently reworking it.
- If a phase reveals that a §2 decision produces a materially worse result, stop and
  report — don't compromise halfway between two directions. The owner has been
  explicit that reverting cleanly is preferred over splitting the difference.

---

## 9. Cross-model review record

The original direction was authored by Codex. Claude audited it against the live
codebase, found five problems, and put them back to Codex directly. All five were
resolved by agreement — this section records the outcome so the reasoning isn't lost.

| # | Contested point | Resolution |
|---|---|---|
| 1 | Codex's audit described a pre-Apple-pass codebase (cyan accent, Space Grotesk body). | **Codex conceded the audit was stale.** Claims about "introducing" system typography or macOS blue are discarded — both already landed. The real diagnosis is the stacked-override problem in §0. |
| 2 | "One inspector whose content changes" would delete the `MAX_SNAPSHOTS = 3` multi-project comparison system. | **Codex reversed its position.** The rule applies to unrelated singleton panels only; comparison snapshots stay first-class. Tabs rejected as a substitute. See §4.3. |
| 3 | "Weather-style charts / one emphasized series" conflicts with 6-series break-even comparison, LCOH scenarios, and TradingView. | **Agreed.** "Weather-style" = quiet chrome, not single-series. All selected series legible at rest; emphasis is an interaction state. See §4.3. |
| 4 | The sidebar merge had a target state but no migration path. | **Agreed, and improved by Codex:** extract behavior from DOM-specific selectors *first* (esp. the Calculator DnD binding at `js/09-router.js:142`), never mount two navs with duplicate IDs, flip the default before deleting legacy markup. See §6 Phase 4. |
| 5 | Logo system, light mode, and mobile rebuild were bundled into one pass. | **Codex confirmed these were end-state vision, not a work order.** All cut to non-goals, plus the aurora. See §5. |

Codex also flagged a method problem on Claude's side: don't `git stash` a shared dirty
tree to obtain a test baseline. Folded into §7.
