# CLAUDE.md – Cake Factory: Sweet Automation

© 2026 Brakeco Games. Handoff notes for Claude Code sessions on this repo.

## Working with Remco (owner)
- Talk to Remco in **Dutch**. All in-game text stays **English**.
- "**lb**" = loopband = conveyor belt.
- Every new game file keeps the copyright "© 2026 Brakeco Games" (start screen + source headers).
- Remco tests by playing the live build and sends annotated screenshots; arrows/boxes in them are
  instructions, not part of the game.
- He prefers results over plans: implement, test, push, then summarise briefly.

## Commands
- `npm install`, `npm run dev` (add `#debug` to the URL: diagnostics + `window.__cakeFactory`).
- `npm test` – node:test suites (must stay green). `npm run build` – Vite build to `dist/`.
- Pushing to `main` deploys automatically to GitHub Pages:
  https://brakecogames.github.io/Cake-Factory/ (workflow `.github/workflows/deploy.yml`).

## Architecture rules (see README.md for detail)
- Simulation (`src/simulation`, `src/machines`, `src/cakes` except CakeRenderer, `src/gameplay`,
  `src/storage`) never imports Three.js or touches the DOM. Renderers only read state.
- The UI changes the game only through `Game` actions (buildMachine, buildBeltPath, removeEntity,
  rotateEntity, moveEntity, configureMachine, upgradeMachine, buyGlobal).
- Saves are versioned (`SAVE.FORMAT_VERSION` + `SaveMigration.js`); add a migration for any format
  change and never break old saves. Orders are saved by id; removed orders go in `RETIRED_ORDERS`.
- Cake quadrants are **world-fixed**: 0=TL (−X,−Z), 1=TR, 2=BR, 3=BL. Cutter L exit = west half
  (TL+BL), R exit = east half. 2D cake pictures are rotated to match the camera
  (`viewRot = π/2 − camera.azimuth`).
- Machine visuals: belts run through processors (`MachineDefs.paths` / `beltRuns`), belts end and
  start over rollers at machines, froster/rotator use turntables, cutter has a sliding blade +
  pneumatic pusher, combiner is a gantry robot. Keep these behaviours when changing models.
- A test checks every scripted order is producible with what earlier orders unlocked – keep it green
  when editing `OrderDefs.js`.

## History
- Phases 1–3 (foundation, cake transformations, tycoon systems) plus shop, visuals and fixes were
  built in a claude.ai chat; later work (improvement loop, endless play, wings) is in
  `GAME_IMPROVEMENT_LOG.md` and the README.
