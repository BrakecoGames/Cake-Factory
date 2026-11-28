# CLAUDE.md – Cake Factory: Sweet Automation

© 2026 Brakeco Games. HTML5 / Three.js factory-automation tycoon for CrazyGames and Poki.
Handoff notes for Claude Code sessions on this repo; see README.md for the code.

## Working with Remco (owner)
- Talk to Remco in **Dutch**. All in-game text stays **English**.
- "**lb**" = loopband = conveyor belt.
- Every new game file keeps the copyright "© 2026 Brakeco Games" (start screen + source headers).
- Remco tests by playing the live build and sends annotated screenshots; arrows/boxes in them are
  instructions, not part of the game.
- He prefers results over plans: implement, test, push, then summarise briefly.
- Make a git checkpoint before big changes.
- **Upload** (bump version, commit, push to `main`, check the live build) only when Remco says
  "upload"/"uploaden". After every push to `main`: `npm run archive` (version folder, see below).
- Reports go in `docs/rapporten/`, progress files of running work in `docs/voortgang/`.
- Never enter passwords or tokens; Remco's e-mail address is private.

## Commands
- `npm install`, `npm run dev` (add `#debug` to the URL: diagnostics + `window.__cakeFactory`).
- `npm test` – node:test suites (must stay green). `npm run build` – Vite build to `dist/`.
- `npm run build:crazygames` – same build with the CrazyGames SDK v3 adapter.
- `npm run archive` – builds the CrazyGames version and writes the version folder + `.url` next to
  `02. Broncode` (`--out <dir>` to write elsewhere).
- Pushing to `main` deploys automatically to GitHub Pages:
  https://brakecogames.github.io/Cake-Factory/ (workflow `.github/workflows/deploy.yml`).
- Test with Playwright on desktop and phones (portrait and landscape) and in the 960×540
  CrazyGames frame.

## Version
`version` in `package.json` and `GAME_VERSION` in `src/core/Config.js` must be equal
(`npm run archive` checks this).

## Architecture rules (see README.md for detail)
- Simulation (`src/simulation`, `src/machines`, `src/cakes` except CakeRenderer, `src/gameplay`,
  `src/storage`) never imports Three.js or touches the DOM. Renderers only read state.
- The UI changes the game only through `Game` actions (buildMachine, buildBeltPath, removeEntity,
  rotateEntity, moveEntity, configureMachine, upgradeMachine, buyGlobal, buyWing, switchContract).
- Saves are versioned (`SAVE.FORMAT_VERSION` + `SaveMigration.js`); add a migration for any format
  change and never break old saves (new fields optional; `tests/fixtures/` holds an old save as a
  regression test). Orders are saved by id; removed orders go in `RETIRED_ORDERS`.
- Cake quadrants are **world-fixed**: 0=TL (−X,−Z), 1=TR, 2=BR, 3=BL. Cutter L exit = west half
  (TL+BL), R exit = east half. 2D cake pictures are rotated to match the camera
  (`viewRot = π/2 − camera.azimuth`).
- Machine visuals: belts run through processors (`MachineDefs.paths` / `beltRuns`), belts end and
  start over rollers at machines, froster/rotator use turntables, cutter has a sliding blade +
  pneumatic pusher, combiner and stacker are gantry robots. Keep these behaviours when changing
  models. Static model parts are merged by `bakeStatic` – keep animated/recoloured parts in `parts`.
- A test checks every scripted order is producible with what earlier orders unlocked, and another
  rebuilds 300 generated endless orders – keep them green when editing `OrderDefs.js` /
  `RecipeGenerator.js`.
- Keep the CrazyGames SDK integration (`src/platforms/CrazyGamesAdapter.js`) and performance intact.

## Folder layout on Remco's PC (same for every Brakeco game)
`C:\Users\Remco\iCloudDrive\Brakeco Games\06. Cake Factory\`

```
06. Cake Factory\
  .claude\
  01. Afbeeldingen\                              artwork, screenshots, promo
  02. Broncode\                                  this repository (git working dir)
  03. Bronmateriaal\                             references, raw assets, notes
  Cake Factory versie <YYYY-MM-DD> v<version>\   per upload: CrazyGames zip + versie.txt
  Cake Factory.url                               shortcut to the live game
```

- Git storage lives outside iCloud: `C:\Users\Remco\GitRepos\cake-factory.git`; `02. Broncode`
  holds a `.git` file pointing to it (iCloud damages git storage).
- `node_modules` also lives outside iCloud (`C:\Users\Remco\GitRepos\cake-factory-node_modules`),
  linked into `02. Broncode` as a junction.
- One-time setup on Windows: `tools/setup-windows.ps1` (see the notes at the top of the script).

## History
- Phases 1–3 (foundation, cake transformations, tycoon systems) plus shop, visuals and fixes were
  built in a claude.ai chat; later work (improvement loop, endless play, wings) is in
  `docs/rapporten/GAME_IMPROVEMENT_LOG.md` and the README.
