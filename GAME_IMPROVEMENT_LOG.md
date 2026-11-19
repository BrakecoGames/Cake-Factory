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
