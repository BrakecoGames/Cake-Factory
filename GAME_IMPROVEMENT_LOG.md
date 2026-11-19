# Game Improvement Log – Cake Factory: Sweet Automation

Autonomous improvement loop (analyse → plan → implement → test → evaluate → decide).
Restore point before the loop: git tag `pre-improvement-loop`.

## Test setup

- `npm test` – node:test suites (simulation, cakes, gameplay, saves).
- `npm run build` – Vite production build.
- Browser: Playwright + headless Chromium (SwiftShader software WebGL) against `npm run dev`
  (`#debug` exposes `window.__cakeFactory`). The scripted session plays the real tutorial with
  **real mouse / touch input**: Play → "Got it" → Conveyor tool → drag a belt from the oven to the
  station → waits for the first delivery and the completed order → reloads and checks the save.
  Runs at 1366×768 (desktop) and iPhone 13 emulation (390×844, touch).
- **Not measurable here:** real FPS. SwiftShader renders on the CPU (4–15 FPS); FPS numbers in
  this log are therefore never used as evidence. Draw calls and sim-time are.

## Phase 1 – analysis (baseline)

Tech: Three.js 0.160 + Vite, ES modules, fixed 30 Hz simulation with interpolation, data-driven
machines/orders, versioned saves with migrations, 83 passing tests, build OK.

Baseline browser results: game boots without errors, the tutorial path works on desktop, a
completed order + save/reload work. One Three.js warning (`parameter 'color' has value of
undefined`).

Top 10 improvement points (impact on player / retention, risk, effort):

| # | Problem | Impact | Risk | Effort |
|---|---|---|---|---|
| 1 | **Phone portrait: the oven sits behind the order panel** – the first tutorial step ("drag from the oven") cannot be done; HUD buttons clipped off-screen | Critical (first 30 s on mobile) | Low | S |
| 2 | Desktop: tutorial card covers the oven it talks about | High (first 5 s) | Low | S |
| 3 | No CrazyGames SDK integration (only a standalone adapter) | High (publishing) | Medium | M |
| 4 | Oven panel always says "Whole vanilla cake" whatever the flavor; Three.js `color undefined` warning | Medium (trust/clarity) | Low | S |
| 5 | Little to chase after the 8 scripted orders except growing contracts – no milestones | High (retention) | Low | M |
| 6 | No feedback when there is nothing to do (idle factory, order needs a new machine) | Medium | Low | S |
| 7 | Draw calls grow per machine (no instancing for machine models) – check on large factories | Medium (mobile perf) | Medium | M |
| 8 | Mobile toolbar scrolls horizontally without any hint | Low/Medium | Low | S |
| 9 | Order completion modal blocks play for up to 5 s every order | Low | Low | S |
| 10 | Start screen has no "what is this game" visual hook beyond text | Low | Low | S |

---

## Iteration 1 – Camera framing + mobile portrait layout

**Problem.** On a phone (390×844) the starting oven was hidden behind the order panel, so the
first tutorial step could not be done (automated touch test: 0 belts built, no delivery in 30 s).
The HUD overflowed: the pause button was cut off. On desktop the tutorial card covered the oven.

**Change.**
- `CameraController.frame(points, free, rect)` – fits world points into a screen rectangle and
  snaps there.
- `UI.freeRect()` – measures the screen area that panels leave free (side panels shrink it
  horizontally, top/bottom bars vertically).
- `main.js` frames all machines into that free area when the game starts and after a reset.
- CSS: portrait phones get a compact horizontal order card (picture left, name/progress right);
  ≤480 px wide screens show only the logo icon + level so every HUD button fits; tutorial text
  slightly smaller on portrait.

**Files.** `src/rendering/CameraController.js`, `src/ui/UI.js`, `src/main.js`, `src/styles.css`.

**Tests.** `npm test` 83/83. Playwright desktop + iPhone 13: full tutorial path with real input.

**Results.** Mobile: belt built by touch drag, first cake delivered 3.3 s later, order completed,
save survives reload. Desktop: oven + station both in clear view below the tutorial card.
Screenshots checked by eye.

**Remaining.** Mobile toolbar still needs horizontal scrolling for the later tools.

| Area | Score | Basis |
|---|---|---|
| First impression | 7/10 | screenshots |
| Gameplay | 7/10 | estimate |
| Visual quality | 8/10 | screenshots |
| Usability | 7/10 | tested |
| Progression | 6/10 | estimate |
| Retention potential | 5/10 | estimate |
| Performance | 7/10 | estimate (draw calls measured) |
| Stability | 8/10 | tested |
| Mobile experience | 7/10 | tested (was 3/10) |
| CrazyGames suitability | 5/10 | estimate (no SDK) |

---

## Iteration 2 – Console warning + oven panel text

**Problem.** Three.js warned `parameter 'color' has value of undefined` on every boot: jar
colours on the wall shelves were picked with a fractional array index (`12.5 % 5`), so some jars
had no colour. The oven panel always said "Whole vanilla cake", even for chocolate ovens.

**Change.** Integer index for the jar palette; oven panel names the configured flavor.

**Files.** `src/rendering/FactoryRenderer.js`, `src/ui/UI.js`.

**Tests.** Playwright console capture with stack trace (0 warnings after the fix); `npm test` 83/83.

**Scores.** Unchanged except Stability 8 → 8.5 (tested: clean console).

---

## Iteration 3 – CrazyGames SDK v3 integration

**Problem.** Only a standalone adapter existed; CrazyGames requires SDK lifecycle events
(`loadingStart/Stop`, `gameplayStart/Stop`) and benefits from cloud saves and `happytime`.

**Change.**
- New `src/platforms/CrazyGamesAdapter.js` with the same interface as the standalone adapter.
  Loads the SDK script only when selected; storage through `SDK.data` with a read fallback to
  localStorage (existing saves keep working; localStorage is never cleared); duplicate
  gameplayStart/Stop calls are filtered; `happytime()` on order completion; honours `muteAudio`.
- Selection: `npm run build:crazygames` (`.env.crazygames`), `*.crazygames.*` hostnames, or
  `?platform=crazygames`. SDK load failure / disabled environment → standalone fallback.

**Files.** `src/platforms/CrazyGamesAdapter.js` (new), `src/platforms/StandaloneAdapter.js`,
`src/main.js`, `package.json`, `.env.crazygames` (new), `README.md`, `tests/platform.test.js` (new).

**Tests.** 5 new unit tests (lifecycle, storage fallback, disabled env, no data module,
detection) – 88/88 pass. Browser with a mocked SDK: calls
`init, loadingStart, loadingStop, gameplayStart, gameplayStop (pause), gameplayStart`; save lands
in SDK data; "✓ Saved". Browser with the SDK URL blocked: boots standalone in 2.7 s. Both builds OK.

**Not tested.** The real CrazyGames SDK (no access to their QA tool from here). Next step for a
human: upload `npm run build:crazygames` output to the CrazyGames developer portal QA tool.

| Area | Score | Basis |
|---|---|---|
| First impression | 7/10 | screenshots |
| Gameplay | 7/10 | estimate |
| Visual quality | 8/10 | screenshots |
| Usability | 7/10 | tested |
| Progression | 6/10 | estimate |
| Retention potential | 5/10 | estimate |
| Performance | 7/10 | estimate |
| Stability | 8.5/10 | tested |
| Mobile experience | 7/10 | tested |
| CrazyGames suitability | 7/10 | tested with mock SDK (was 5) |

---

## Iteration 4 – Large-factory performance check + order panel overflow

**Problem / check.** Unknown behaviour of big factories; order panel height unbounded.

**Measured (Playwright, 36×36 factory, 70 machines, 490 belts, 52 cakes moving).**
385 draw calls, 0.5 ms simulation per tick, no errors. Belts are already instanced; machine draw
calls scale linearly but stay well within budget. **Decision: no renderer change** (risk without
measurable benefit). The screenshot did show a real UI bug: with bonus + rejected cake + hint the
order panel grew over the camera buttons.

**Change.** Order panel gets a `max-height` (desktop, landscape phone, portrait phone) with a thin
scrollbar; name, picture and progress stay on top.

**Files.** `src/styles.css`.

**Tests.** Stress script screenshot; regression play tests.

---

## Iteration 5 – Milestones (long-term goals)

**Problem.** After the 8 scripted orders the only goals were ever-larger contracts; nothing showed
the player what to aim for next. Weak retention for sessions 2+.

**Change.**
- `src/gameplay/MilestoneManager.js` (pure data, no DOM): 18 milestones over cakes delivered,
  orders completed, time bonuses, production machines, machine upgrades, total earnings and
  factory expansions, with cash rewards ($50 → $8,000). Progress is read from real game state,
  so it can never desync.
- `Game.milestoneStats()`, check twice per second, rewards via `EconomyManager.grant()` (not
  counted as production income), `milestone` event.
- Save: optional `milestones` + `stats` fields (format stays v4, fully backward compatible).
  Old saves get an estimate of delivered cakes from finished orders; already-deserved milestones
  are announced and paid on the next check.
- UI: the logo/level chip is now a button with a 🏆 counter and a red dot for new milestones;
  toast + upgrade sound when reached; Milestones panel with progress bars, closest goals first.
- Pacing: first milestone (10 cakes) lands during order 2 (≈1–2 min in), 3 orders at ≈5 min.

**Files.** `src/gameplay/MilestoneManager.js` (new), `src/core/Game.js`,
`src/gameplay/EconomyManager.js`, `src/ui/UI.js`, `index.html`, `src/styles.css`,
`tests/milestones.test.js` (new).

**Tests.** 4 new tests (unique ids, reached by real play and paid once, not counted as income,
save round-trip + old-save estimate, unknown ids ignored) – 92/92. Browser: toast, counter, panel
checked on desktop and iPhone 13; full tutorial regression on both. Found and fixed during the
test: level/size goals showed "1/2" progress before doing anything → stats made 0-based.

| Area | Score | Basis |
|---|---|---|
| First impression | 7/10 | screenshots |
| Gameplay | 7/10 | estimate |
| Visual quality | 8/10 | screenshots |
| Usability | 7.5/10 | tested |
| Progression | 7/10 | estimate (was 6) |
| Retention potential | 6.5/10 | estimate (was 5) |
| Performance | 7.5/10 | measured draw calls / sim time |
| Stability | 8.5/10 | tested |
| Mobile experience | 7/10 | tested |
| CrazyGames suitability | 7/10 | tested with mock SDK |

---

## Iteration 6 – Clearer orders, rejections and machine onboarding

**Problem (found by playing orders 1–3 with real clicks).**
1. Right after order 1, plain cakes still on the belt were rejected with "The frosting does not
   match" – vague, at the exact moment a new player needs direction.
2. Order descriptions such as "Vanilla | — | — | Vanilla" (Half Moon) were cryptic.
3. The tutorial ends after the Frosting Machine, but the Cutter (L/R exits + trash) is the biggest
   difficulty jump of the first 10 minutes; only a text hint explained it.

**Change.**
- `diagnoseMismatch`: "Needs pink frosting – add a Frosting Machine to the line", "Wrong frosting
  colour: white instead of pink", "No frosting wanted – take the Frosting Machine out of this line".
- `describeCake`: "Left half Vanilla", "Left Vanilla · right Chocolate", "Top Chocolate · bottom
  Vanilla", quadrant labels (TL/TR/BR/BL) only when needed.
- "How it works" cards with a small diagram for the Cutter, Combiner and Rotator. Shown once, when
  an order first needs a machine the player has never built; dismissed with "Got it" or by placing
  the machine; stored in the save (`seenTips`, optional field); never shown after "Skip tutorial".
  The highlighted tool button points at the machine. On portrait phones the order hint hides while
  a card is open (it repeated the same text).
- Level chip text no longer wraps on phones.

**Files.** `src/gameplay/Diagnose.js`, `src/cakes/CakeModel.js`, `src/core/Game.js`, `src/ui/UI.js`,
`src/styles.css`, `tests/cakes.test.js`, `tests/milestones.test.js`.

**Tests.** 3 new tests (descriptions, frosting reasons, tip lifecycle incl. save + skip) – 95/95.
Browser: tip card desktop + iPhone 13 (shown, "Got it" hides and saves); orders 1→2 regression with
real clicks (frosting machine dropped onto the belt, order 2 done in 39 s, cutter card appears).

| Area | Score | Basis |
|---|---|---|
| First impression | 7.5/10 | screenshots |
| Gameplay | 7/10 | estimate |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 7.5/10 | estimate |
| Retention potential | 6.5/10 | estimate |
| Performance | 7.5/10 | measured |
| Stability | 8.5/10 | tested |
| Mobile experience | 7.5/10 | tested |
| CrazyGames suitability | 7/10 | tested with mock SDK |

---

## Iteration 7 – Verification: can the Cutter order be built with clicks?

**Check.** Played "Half Moon" with real mouse input from the post-order-2 state: Cutter tool →
click on the existing belt → the cutter auto-rotates into the line and replaces the belt; its empty
R exit shows a red **!** and the status "No output connected"; Trash tool → click on the cell in
front of the R exit; order completed (6 cakes) without errors.

**Decision.** No code change needed – the core build loop for the first difficulty jump works as
designed. (Kept as an iteration because it is the evidence for the Gameplay/Usability scores.)

---

## Iteration 8 – Non-blocking celebration for repeatable contracts

**Problem.** Every completed order opened a modal that disabled input for up to 5 s. For scripted
orders this is right (new unlocks to show), but repeatable contracts unlock nothing and are
completed again and again in long sessions – an interruption without information.

**Change.** Contracts without unlocks now show a non-blocking banner (amount, bonus result, next
contract) with confetti and the completion sound; the factory stays controllable. Scripted orders
keep the modal.

**Files.** `src/ui/UI.js`, `src/styles.css`.

**Tests.** Browser: completing contract #1 shows the banner, the modal stays hidden, no errors
(screenshot checked). `npm test` 95/95.

| Area | Score | Basis |
|---|---|---|
| First impression | 7.5/10 | screenshots |
| Gameplay | 7.5/10 | tested (orders 1–3 by clicks) |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 7.5/10 | estimate |
| Retention potential | 7/10 | estimate |
| Performance | 7.5/10 | measured |
| Stability | 8.5/10 | tested |
| Mobile experience | 7.5/10 | tested |
| CrazyGames suitability | 7/10 | tested with mock SDK |

---

## Iteration 9 – Phone toolbar and HUD on every screen width

**Problem.** On phones only ~5 of 13 tool buttons fit, with no sign that more exist; a highlighted
tool (e.g. the Rotator in its "how it works" card) could be off-screen. A device sweep showed that
on 320 px phones (iPhone SE, Galaxy S9+) Settings and Pause were pushed off the screen, and on
short portrait phones the Reset-view button sat behind the bottom cards.

**Change.**
- Toolbar: edge fades where tools are hidden (`more-left` / `more-right`, updated on scroll and
  resize), scroll-snap, and highlighted tools scroll to the centre automatically.
- ≤480 px: chip shows "Level N 🏆 M" without the logo. ≤360 px: compact HUD buttons, and Help
  moves into Settings (new "How to play" button there, so nothing becomes unreachable).
- Short portrait phones (≤760 px high): the two tilt buttons are hidden (three-finger tilt and the
  other controls remain), so Reset view is always reachable.

**Files.** `src/ui/UI.js`, `src/styles.css`.

**Tests.** Playwright device sweep (iPhone SE, iPhone 13, Pixel 5, Galaxy S9+, iPad Mini): no HUD
button, panel or card outside the viewport; Reset view above the tutorial card on all phones;
Rotator auto-scrolled to x 152–214 of 390. `npm test` 95/95.

| Area | Score | Basis |
|---|---|---|
| First impression | 7.5/10 | screenshots |
| Gameplay | 7.5/10 | tested |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 7.5/10 | estimate |
| Retention potential | 7/10 | estimate |
| Performance | 7.5/10 | measured |
| Stability | 8.5/10 | tested |
| Mobile experience | 8.5/10 | tested on 5 device profiles (was 7.5) |
| CrazyGames suitability | 7.5/10 | tested with mock SDK + device sweep |

---

## Iteration 10 – Long-session stability (soak tests)

**Check.** Browser soak: 6 ovens on 6 belt lines into the station, 2 minutes of real rendering with
continuous deliveries/rejections, popups and toasts. Snapshots every 30 s after forced GC:

| t | JS heap | DOM nodes | GPU geometries | textures |
|---|---|---|---|---|
| 0 s | 23.7 MB | 293 | 99 | 10 |
| 60 s | 25.0 MB | 293 | 115 | 11 |
| 120 s | 25.2 MB | 293 | 115 | 11 |

Flat after warm-up, 0 console errors. Headless: 30 minutes of simulation time (new
`tests/milestones.test.js` case) – income/delivery windows stay trimmed, items on belts do not
pile up, money never drops without spending.

**Decision.** No leak found → no code change; the soak test stays in the suite as a regression
guard. 96/96 tests.

**Scores.** Stability 8.5 → 9 (tested).

---

## Iteration 11 – Background music

**Problem.** Only short synthesized effects; long building sessions were silent, which feels
unfinished next to other CrazyGames titles.

**Change.** `AudioManager.startMusic()` – a gentle procedural music-box loop (no audio files, no
new dependencies): I–vi–IV–V in C at 92 bpm, soft bass, quiet arpeggio and an 8-bar pentatonic
melody through a low-pass filter. Notes are scheduled 0.5 s ahead on the audio clock (frame-rate
independent) and resume cleanly after a tab suspend. It starts with Play, routes through the
master bus (so Mute and the CrazyGames `muteAudio` setting silence it too) and has its own
**Music** slider in Settings (new `settings.music`, default 0.5; older saves get the default).
"Sound volume" is now "Volume" (master).

**Files.** `src/audio/AudioManager.js`, `src/core/Game.js`, `src/main.js`, `src/ui/UI.js`.

**Tests.** Browser: 24 oscillators scheduled in the first 3 s after Play, no errors. Offline
render of 16 s at maximum volume: peak 0.114, RMS 0.014 – no clipping, sits below the effects
(first render was too quiet at peak 0.066 → bus gain raised). `npm test` 96/96.

**Not tested.** How it *sounds* – no human listening was possible here. If it is not liked, the
Music slider at 0 turns it off; deleting the `startMusic()` call removes it.

| Area | Score | Basis |
|---|---|---|
| First impression | 8/10 | estimate (music + screenshots) |
| Gameplay | 7.5/10 | tested |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 7.5/10 | estimate |
| Retention potential | 7/10 | estimate |
| Performance | 7.5/10 | measured |
| Stability | 9/10 | tested |
| Mobile experience | 8.5/10 | tested |
| CrazyGames suitability | 7.5/10 | tested with mock SDK |

---

## Iteration 12 – Contract balance for long-term play

**Problem.** Repeatable contracts always demanded the same pace for the time bonus (2.2 s per cake
≈ 27 cakes/min) and paid the same per cake. After a few upgrades the bonus became trivial and
contracts only got longer, so upgrades stopped mattering.

**Change.** Bonus pace tightens by 0.05 s per contract to a floor of 1.2 s per cake (27 → 50
cakes/min at contract #21+); pay per cake grows 4 % per contract, capped at ×2. Examples:
#1 20 cakes / 44 s / $15 · #10 65 / 114 s / $20 · #20 115 / 144 s / $44 · #30 165 / 198 s / $100.
50/min is reachable with upgraded ovens (level 5 oven ≈ 58/min) and is only needed for the
optional bonus. Saves are unaffected (a contract in progress keeps its id and progress).

**Files.** `src/gameplay/OrderDefs.js`, `tests/gameplay.test.js`.

**Tests.** New test (pace floor, growth, cap) – 97/97.

**Scores.** Progression 7.5 → 8, Retention 7 → 7.5 (estimates).

---

## Iteration 13 – Production build verified; self-hosted font

**Check.** Built `npm run build` and `npm run build:crazygames`, served the static output and
played it without the debug hooks (desktop 1280×720, Pixel 5; CrazyGames build with a mocked
SDK). No console errors, debug overlay and `window.__cakeFactory` absent in production, SDK
lifecycle `loadingStart → loadingStop → gameplayStart`.

**Problem found.** The only external requests were Google Fonts (fonts.googleapis.com /
fonts.gstatic.com): a privacy/GDPR concern for EU players, an extra round-trip on boot, and a
broken look where that domain is blocked. The 3D canvas signs could also be drawn before the font
arrived (system-font fallback).

**Change.** Fredoka (SIL OFL 1.1, licence file included) self-hosted as two variable woff2 files
(latin 29.7 KB + latin-ext 4.6 KB) with `@font-face` + preload; Google Fonts links removed;
`main.js` waits for the font (max 1.5 s) before the renderer draws its canvas signs.

**Files.** `index.html`, `src/styles.css`, `src/main.js`, `src/fonts/` (new: 2 woff2 + OFL licence).

**Tests.** Production browser test: 0 external requests, font status "loaded", boot to Play
2.3 s (was 4.5 s) desktop / 1.4 s mobile, no errors, both builds. `npm test` 97/97.

| Area | Score | Basis |
|---|---|---|
| First impression | 8/10 | screenshots |
| Gameplay | 7.5/10 | tested |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 8/10 | estimate |
| Retention potential | 7.5/10 | estimate |
| Performance | 8/10 | measured (boot time, draw calls) |
| Stability | 9/10 | tested |
| Mobile experience | 8.5/10 | tested |
| CrazyGames suitability | 8.5/10 | tested: prod build, mock SDK, no external requests |

---

## Iteration 14 – A real choice for every contract

**Problem.** Repeatable contracts rotated through six completely different recipes, so after each
contract the player had to tear down and rebuild the line – frustrating, and there was no decision
to make.

**Change.** From contract #2 on, the order panel offers a switch (before the first cake only, so
no progress can be lost):
- **New** – the rotation's recipe at full pay (variety, more money), or
- **Repeat** – the previous contract's recipe at 85 % pay ("same line as last time").
The choice is saved (`orders.recipe`, `orders.lastRecipe`; optional fields, old saves get the
rotation). The customer's speech bubble in the shop follows the switch. The generic contract hint
now only shows on contract #1 (less clutter on phones).

**Files.** `src/gameplay/OrderDefs.js`, `src/gameplay/OrderManager.js`, `src/core/Game.js`,
`src/ui/UI.js`, `src/rendering/ShopRenderer.js`, `index.html`, `src/styles.css`,
`tests/gameplay.test.js`.

**Tests.** New test: no offer on contract #1, repeat offered on #2 with lower pay, switching back
and forth, persisted through save/load, locked after the first cake, never on scripted orders –
98/98. Browser (desktop + iPhone 13): button switches "Half & Half Contract #2" → "Pink Vanilla
Contract #2", no errors; tutorial and contract-banner regressions pass.

| Area | Score | Basis |
|---|---|---|
| First impression | 8/10 | screenshots |
| Gameplay | 8/10 | tested (choices added) |
| Visual quality | 8/10 | screenshots |
| Usability | 8/10 | tested |
| Progression | 8/10 | estimate |
| Retention potential | 8/10 | estimate (was 7.5) |
| Performance | 8/10 | measured |
| Stability | 9/10 | tested |
| Mobile experience | 8.5/10 | tested |
| CrazyGames suitability | 8.5/10 | tested |

---

## Iteration 15 – Proof that existing saves survive every change

**Check.** Rule 2 (keep savegames). Created saves with the **original code** (git worktree of tag
`pre-improvement-loop`): an early-game save (tutorial running, one line) and a late-game save
(contract #3 with 7/30 delivered, factory expanded to 24×24, faster belts, a level-3 oven,
10 completed orders). Loaded both with the current code.

**Results.** No validation or load problems; money, order, progress, factory size, global
upgrades and machines identical; new fields get defaults (music 0.5, no seen tips, cakes estimated
from orders); deserved milestones (6) granted on the first check; re-saving and reloading is
lossless. Browser: the old save in localStorage shows "Continue · Welcome back! Level 11 ·
$47,875", 🏆 6, "Sunrise Contract #3 · 7 / 30", no errors.

**Change.** The late-game save is kept as `tests/fixtures/save-v4-before-improvements.json` with a
permanent regression test in `tests/save.test.js` – 99/99. Save format stays v4 (all new fields
optional), so no migration step was needed.

---

## Iteration 16 – Phones held sideways (short landscape)

**Problem (found by a landscape device sweep).** On iPhone 13 / Pixel 5 / iPhone SE in landscape
(293–342 px high) the tutorial card, order panel, toolbar and camera buttons overlapped and covered
the whole factory: the oven and the station were hidden behind the tutorial text, Reset view was
off-screen. The game was effectively unplayable sideways – a common orientation on CrazyGames mobile.

**Change.** A dedicated layout for `landscape and max-height ≤ 500px`: compact HUD; tutorial as a
narrow card on the left; compact order card on the right (picture + name + progress); smaller
toolbar; inspector/toasts above the toolbar; camera buttons reduced to zoom + reset, and hidden on
touch screens (pinch/twist/drag cover them). `UI.freeRect()` now treats narrow panels against a
screen edge (incl. the tutorial card) as side panels, so the camera frames the factory in the
middle gap. Centred cards (desktop tutorial) still count as top panels.

**Files.** `src/styles.css`, `src/ui/UI.js`.

**Tests.** Landscape sweep (3 devices): no panel overlaps, nothing off-screen, oven and station
not covered. Full tutorial with touch on iPhone 13 landscape: belt dragged, first cake 3.2 s later,
order complete, save reload. Portrait sweep (5 devices) and desktop tutorial regression unchanged.
`npm test` 99/99.

| Area | Score | Basis |
|---|---|---|
| First impression | 8/10 | screenshots |
| Gameplay | 8/10 | tested |
| Visual quality | 8/10 | screenshots |
| Usability | 8.5/10 | tested |
| Progression | 8/10 | estimate |
| Retention potential | 8/10 | estimate |
| Performance | 8/10 | measured |
| Stability | 9/10 | tested |
| Mobile experience | 9/10 | tested portrait + landscape (landscape was ~2/10) |
| CrazyGames suitability | 8.5/10 | tested |

---

## Iteration 17 – The 960×540 CrazyGames frame and other desktop sizes

**Problem (size sweep 960×540, 1024×576, 800×600, 1280×720, 1920×1080).** CrazyGames shows desktop
games in a frame of about 960×540. There the camera buttons overlapped the toolbar (Reset view
hidden), the Delete tool was cut off, the order panel clipped its progress bar and the centred
tutorial card left only a thin strip for the factory, so machines were tiny. The customer the
tutorial talks about was outside the view on several sizes.

**Change.**
- Layout for landscape screens 501–760 px high: tutorial as a card on the left, compact horizontal
  order card on the right, slightly smaller toolbar, camera buttons above the toolbar (tilt
  buttons hidden; middle-mouse drag and Page Up/Down still tilt), inspector and toasts above the
  toolbar.
- While the tutorial runs, the camera frame includes the customer at the Cake Shop counter.

**Files.** `src/styles.css`, `src/main.js`.

**Tests.** Size sweep: no overlaps and nothing off-screen at 960×540, 1024×576, 1280×720,
1920×1080 (800×600 only scrolls the last tool inside the faded toolbar, by design); oven and
station never covered. Landscape/portrait phone sweeps and the iPhone 13 touch tutorial still pass.
`npm test` 99/99. Screenshots checked.

| Area | Score | Basis |
|---|---|---|
| First impression | 8.5/10 | screenshots at the CrazyGames frame size |
| Gameplay | 8/10 | tested |
| Visual quality | 8/10 | screenshots |
| Usability | 8.5/10 | tested |
| Progression | 8/10 | estimate |
| Retention potential | 8/10 | estimate |
| Performance | 8/10 | measured |
| Stability | 9/10 | tested |
| Mobile experience | 9/10 | tested |
| CrazyGames suitability | 9/10 | tested at frame size, prod build, mock SDK |

---

## Iteration 18 – Modals on short screens

**Problem.** On a phone held sideways (342 px high) the "Order completed!" card was taller than
the screen: the Continue button sat below the fold (the card scrolled). The start card and cake
inspector were also oversized there; "PER CAKE" wrapped in the narrow order card.

**Change.** For screens ≤500 px high: compact modal padding/headings, smaller cake pictures in the
celebration and cake inspector, tighter unlock list, smaller start card. Order reward labels
never wrap.

**Files.** `src/styles.css`.

**Tests.** Celebration modal on iPhone 13 landscape: Continue fully visible, no scrolling (was
hidden); 960×540 unchanged. Landscape and desktop size sweeps still clean. `npm test` 99/99.

---

## Iteration 19 – Final regression and stop

**Full regression.** 99/99 unit/integration tests; both production builds; production browser
test (desktop, Pixel 5, CrazyGames build with mock SDK): no errors, no external requests, font
loaded, boot 1.3–2.4 s; scripted play of orders 1→3 with real clicks; machine tips; contract
switch; milestones; contract banner; pre-loop save in the browser; mocked SDK lifecycle +
cloud save; SDK load failure → standalone fallback. All passed.

**Stop condition reached.** The remaining improvements need human input or real hardware rather
than more code here:
1. Upload `npm run build:crazygames` to the CrazyGames developer QA tool (real SDK, ads policy).
2. Measure real FPS on a mid-range phone (only software rendering was available here; draw calls
   and sim time were measured instead).
3. Listen to the background music and decide whether it stays.
4. Watch a few new players: are the Cutter/Combiner cards enough for the Half & Half and
   Four Flavors orders?

## Summary of the loop

| # | Improvement | Evidence |
|---|---|---|
| 1 | Camera frames the factory into the free screen area; compact phone layout | touch tutorial on iPhone went from impossible to complete |
| 2 | Console warning + oven panel flavor text | 0 warnings |
| 3 | CrazyGames SDK v3 adapter with safe fallback and save migration | 5 unit tests, mock-SDK browser test |
| 4 | Big-factory check (385 draw calls / 70 machines); order panel height cap | stress test |
| 5 | 18 milestones with rewards | 4 tests, browser |
| 6 | Clear rejection reasons, readable cake descriptions, machine "how it works" cards | 3 tests, browser |
| 7 | Verified Cutter order is buildable by clicks | scripted play |
| 8 | Non-blocking contract celebration | browser |
| 9 | Phone toolbar fades + auto-scroll; HUD fits 320 px | 5-device sweep |
| 10 | Soak tests: no leaks (2 min browser, 30 min sim) | memory snapshots |
| 11 | Background music + slider | offline render levels |
| 12 | Contract pace/pay scaling | test |
| 13 | Self-hosted font, production build verified | 0 external requests, boot 4.5 → 2.3 s |
| 14 | Contract choice: new recipe vs repeat | test + browser |
| 15 | Proof that pre-loop saves still load | fixture test + browser |
| 16 | Playable landscape-phone layout | 3-device sweep + touch tutorial |
| 17 | 960×540 CrazyGames frame layout; customer in view | 5-size sweep |
| 18 | Compact modals on short screens | browser |
| 19 | Final regression | all green |

**Score change (start → end).** First impression 6 → 8.5 · Gameplay 7 → 8 · Visual 8 → 8 ·
Usability 6.5 → 8.5 · Progression 6 → 8 · Retention 5 → 8 · Performance 7 → 8 · Stability 8 → 9 ·
Mobile 3 → 9 · CrazyGames suitability 5 → 9. Mobile, stability, performance and CrazyGames scores
are based on tests; gameplay/progression/retention remain expert estimates until real players
have played.

**Saves.** Format stays v4; every new field is optional; a save made by the original version is a
permanent test fixture. No user data was removed.
