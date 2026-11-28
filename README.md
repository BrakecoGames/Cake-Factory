# Cake Factory – Sweet Automation

© 2026 Brakeco Games. All rights reserved.

HTML5 / Three.js factory-automation tycoon for CrazyGames and Poki.
**Current state: Phase 3 – tycoon systems (on top of Phases 1–2).**

## Running

```bash
npm install          # three 0.160.0 + vite
npm run dev          # http://localhost:5173
npm test             # 82 deterministic simulation / gameplay / save tests (no deps needed)
npm run build        # static build → dist/ (index.html + assets/), relative paths
npm run build:crazygames  # same, but boots with the CrazyGames SDK v3 adapter
npm run preview      # serve dist/ to check the production build
```

Without a bundler, `index.html` also runs from any static server: an import map loads
Three.js from jsDelivr. The Vite build strips that import map and bundles Three.js locally.

Debug overlay (FPS, sim time, machines, items, belts, draw calls, save status):
`npm run dev` only (disabled in production builds). Without Vite, append `#debug` to the URL.

## Platforms
- `StandaloneAdapter` – localStorage (memory fallback). Default.
- `CrazyGamesAdapter` – loads the CrazyGames SDK v3, calls `loadingStart/Stop`,
  `gameplayStart/Stop` (pause, tab hidden) and `happytime` (order completed), honours the
  platform's `muteAudio` setting and saves through the SDK data module. Reads fall back to
  localStorage so earlier saves are kept. Chosen by `npm run build:crazygames`, on
  `*.crazygames.*` domains or with `?platform=crazygames`. If the SDK cannot load or is
  disabled, the game continues with the standalone adapter.

## Architecture

```
src/
  core/        Config, EventBus, GameLoop (fixed 30 Hz tick + interpolation), Game (actions API)
  cakes/       CakeModel, CakeOperations, CakeSerializer (pure data)  ·  CakeRenderer (instanced 3D)
  simulation/  Grid (directions, rotation), FactorySimulation (belts, transfer, save state)
  machines/    MachineDefs (data-driven), Machine, Oven, DeliveryStation
  gameplay/    OrderDefs, OrderManager, EconomyManager, TutorialManager
  storage/     SaveManager (async adapter, debounce, coalescing), SaveMigration
  platforms/   StandaloneAdapter (localStorage, memory fallback)
  rendering/   SceneManager, CameraController, FactoryRenderer, ModelFactory, EffectsManager
  input/       InputController (tools, belt dragging, touch, keyboard)
  ui/          UI (HUD, toolbar, order panel, inspector, tutorial, modals), CakePreview (2D)
  audio/       AudioManager (synthesized SFX, unlocked on first gesture)
tests/         node:test suites
```

Rules: `simulation/`, `cakes/` (except CakeRenderer), `machines/`, `gameplay/`, `storage/` never
import Three.js or touch the DOM. The renderer only reads simulation state. The UI changes the
game only through `Game` actions (`buildMachine`, `buildBeltPath`, `removeEntity`,
`rotateEntity`, `moveEntity`). Saves contain logical state only.

### Cake data model
- Layers bottom → top; each layer has exactly 4 quadrants in the order
  **0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left** (clockwise).
- Quadrant = `null` or `{ flavor, frosting|null, decoration|null }`.
- In the world, top = −Z and left = −X.
- Identity key: `flavor:frosting:decoration` per quadrant, `,` between quadrants, `/` between layers
  (`-` = empty, `_` = none). Runtime ids are not part of identity. FNV-1a hash available.
- Operations (pure, tested; machines arrive in Phase 2): rotate CW/CCW/180, cut halves
  (output 0 = left half TL+BL, output 1 = right half TR+BR), cut quarters (TL,TR,BR,BL), combine
  (same layer count, no overlap), stack (max 4 layers), frost / decorate (top layer, optional
  quadrant mask).

### Simulation rules
- Fixed 30 ticks/s; max 8 catch-up ticks per frame (no spiral, no fast-forward after tab switch).
- One cake per belt cell; progress 0 → 1 through a cell (entry edge → centre → exit edge), so
  corners and merges never teleport.
- A cake keeps ≥ 0.72 cells to the cake ahead; at the exit edge it hands off to an empty belt that
  doesn't point back, or to a machine input port facing it; otherwise it waits (backpressure).
  A belt waiting > 0.75 s shows red.
- Belts update downstream-first (dense lines flow without gaps); `lastTick` stops double moves.
- Ovens never bake with a full output buffer; they show a red **!** when blocked or unconnected.
- Removing a part that holds a cake destroys it with a visible poof + toast (never silently).

## Phase 1 content
- Iso orthographic camera: smooth zoom to cursor, drag/middle/Space pan, pinch, Q/E 90° rotation,
  bounds.
- 20×20 grid, ghost previews (green/red, cost, port arrows), click-and-drag belts with automatic
  corners, merges, backtracking while dragging; rotate, move (keeps state), delete (drag), inspect.
- Machines: Basic Oven, Delivery Station (accepts on all 8 edge ports), belts.
- Orders: Vanilla Delight (5), Morning Rush (12, bonus timer), Bakery Fair (25, bonus), then
  repeatable Vanilla Contracts. Per-cake pay + completion reward; bonus timer starts at the first
  correct cake.
- Economy: $500 start, full refunds, income/min and cakes/min over 60 s of sim time.
- Tutorial: 6 event-driven steps (bake → connect → watch → first delivery → order completed →
  second oven / merging). Skippable; the factory is always in a valid state.
- Save: autosave after every action (debounced), every 30 s, on tab hide and page hide; status
  only shows "Saved" after the write resolved; corrupt / newer saves are backed up and never
  overwritten; versioned migrations.
- Quality Low / Medium / High / Auto, adaptive pixel ratio, WebGL-failure and context-loss handling.

## Phase 2 content
- New machines (rotation 0 = cakes enter West, leave East):
  - **Frosting Machine** 1×1, 1.2 s – frosts every piece of the top layer; color picked in its panel.
  - **Cake Cutter** 1×2, 1.4 s – left half (TL+BL) leaves the **L** exit (left of travel), right half
    (TR+BR) the **R** exit. An empty half produces nothing.
  - **Cake Rotator** 1×1, 0.8 s – 90° clockwise (`mode` field ready for CCW/180 upgrades).
  - **Cake Combiner** 1×2, 1.4 s – joins two pieces with the same layer count and no overlap.
    Overlapping pieces are refused at the input (status *Pieces don't fit* + red !).
  - **Trash Bin** 1×1 – accepts from every side, visibly discards.
- Processor cycle: push outputs → work → start only when every output is empty and every input is
  filled. Inputs buffer while working; nothing is produced while blocked.
- Oven flavor selection; new machines inherit the last chosen setting.
- Unlocks derived from completed orders (`unlocksAfter(n)`); locked tools show a lock and the
  order that unlocks them; NEW badges + unlock list in the completion card.
- Orders: Vanilla Delight → Strawberry Frosting → Half Moon → Half & Half →
  Sunrise Cake → Strawberry Cream → Four Flavors → Bakery Fair → repeatable contracts over six
  recipes. Each order has a hint. A test proves every order is buildable with earlier unlocks;
  integration tests build real Half & Half and Sunrise factories and complete the orders.
- Cakes are visible inside machines (on the stage, waiting at exits / entries); the rotator turns
  the cake visually while processing. Permanent green/orange floor arrows mark machine ports.
- Cake inspector (click any cake picture): exact quadrant table + rotation preview (preview only).
- Save format v3 with migration from Phase 1 saves (orders mapped by meaning, stored by id).
- Tutorial step 6 now introduces the Frosting Machine (advances when you place one).

## Phase 3 content (tycoon systems)
- **Machine upgrades**, levels 1–5 (oven, frosting machine, cutter, rotator, combiner). Speed ×1,
  ×1.25, ×1.55, ×1.9, ×2.4; price per step = 75 % / 150 % / 300 % / 600 % of the machine price.
  The machine panel shows level stars and before → after throughput; the Upgrade tool (U) upgrades
  by clicking. Upgraded machines show a ★N badge and a sparkle burst.
  - Oven: buffer 1 → 2 (L3) → 3 (L5).
  - Rotator: counter-clockwise from L2, 180° from L3 (direction picked in its panel).
  - Frosting Machine: from L3 frost only selected quadrants (2×2 toggle grid).
  - Removing a machine refunds its purchase price plus all upgrades.
- **Bakery Upgrades panel** (⬆ in the HUD): Faster Conveyors (belt + machine-belt speed up to
  ×1.9), Bakery Reputation (pay per correct cake up to ×1.5), Factory Expansion 20 → 24 → 28 → 32 →
  36 cells; the factory grows on every side and everything (including cakes on belts) shifts along.
- Save format v4 (migrates v3: global upgrades start at level 1; machine levels were already saved).
- Not in Phase 3 (planned for Phase 4): quarter cutting, layer stacker, decorations, multi-layer
  orders.

## Cake Shop counter (customers)
- `ShopRenderer` (visual only) places a Cake Shop counter on the east (right-hand) side of the
  factory, outside the build grid: counter, display case, cash register, bell, striped awning and
  a CAKE SHOP sign. The camera can pan a little further east to show it.
- A customer (procedural, looks vary per order) walks in and shows the order in a speech bubble
  (cake picture, ×quantity, delivered/quantity). A bell + toast announce the new order.
- Every correct cake flies as a cake box from the delivery station to the counter and is stacked.
- When the order is complete the customer picks up the boxes, says "Thanks!" and walks out; the
  next customer walks in with the next order. Gameplay is never blocked by these animations.

## Conveyors (lb) and machine belts
- `ConveyorRenderer` draws conveyors like real modular belts: blue belt (moves exactly at cake
  speed), white side guards, aluminium legs with feet, dark end caps. Everything is flat – no
  height differences.
- A corner cell (fed from exactly one side) is a real curved 90° belt piece; cakes follow the arc.
  Side merges into a straight belt stay straight.
- The Frosting Machine is modelled on a cake-icing machine: pink body with a control panel, a
  stainless turntable in the belt, a column with a stainless arm and spatulas. The cake stops on
  the turntable, spins two full turns while the spatula spreads the frosting, then rides out.
- Frosting Machine, Rotator, Cutter and Combiner have their own short belts (`MachineDefs.paths`),
  as long as the machine. Cakes ride in, stop at the stage in the middle for processing, and ride
  out (the cutter pushes the right half down to its R exit; the combiner carries piece B up to
  piece A). The simulation models this transit at belt speed, so what you see is the real state.

## Placing machines on belts
- Any machine can be dropped onto existing belts: belts under its footprint are replaced and
  refunded (net price shown in the tooltip, replaced belts flash yellow in the preview).
- Directional machines put their main port (first input, or the oven's output) under the cursor
  and auto-rotate to follow the hovered belt, so they slot straight into a line. Press R to
  override; the override lasts until the cursor leaves the belts.
- A cake on a replaced belt goes into the machine's matching input when possible; otherwise it is
  discarded with the usual poof + toast. Moving a machine onto belts works the same way.

## Improvement loop (see docs/rapporten/GAME_IMPROVEMENT_LOG.md)
- Camera frames the factory into the screen area the panels leave free; dedicated layouts for
  phones (portrait and landscape), the 960×540 CrazyGames frame and desktop.
- 18 milestones with rewards (level chip → Milestones panel); "how it works" cards for the
  Cutter, Combiner and Rotator; clearer rejection reasons and cake descriptions.
- Contracts: pace and pay scale over time, choice between a new recipe and repeating the last one,
  non-blocking celebration banner.
- CrazyGames SDK v3 adapter, self-hosted font (no external requests), procedural background music
  with its own slider.

## Endless play
- After the 8 scripted orders, every contract asks for a **new generated cake**
  (`src/gameplay/RecipeGenerator.js`): deterministic per contract number, a little harder each
  time (more pieces, rotations, frostings, layers, decorations), capped so it stays a puzzle.
  A test rebuilds 300 generated cakes with only the machines unlocked at that point.
- Every 5th contract is a **Showpiece** (double reward); Showpieces and a few contracts unlock
  new things (`CONTRACT_UNLOCKS`): Caramel, **Layer Stacker**, Red Velvet, **Decorator** with
  sprinkles/cherry, cream swirl, strawberry, Pistachio, chocolate pieces, 3- and 4-layer cakes.
- The order panel always shows the next goal ("In 2 orders: Layer Stacker" / "Next Showpiece
  in 3 orders"); 6 extra milestones for long-term play.
- New machines: **Layer Stacker** (1×2, main input = bottom, side input = top, max 4 layers) and
  **Decorator** (1×1, decoration picked in its panel, per-quadrant from level 3). Hotkeys 9 / 0.

## Wings, corridors and decor
- **New wings** (North $6,000 · West $15,000 · South $35,000): 16×16 halls joined to the main
  hall by a **4-cell-wide corridor** – belts (up to 4 side by side) run through it. Buy from the
  FOR SALE plots in the world or in Bakery Upgrades. `src/simulation/Layout.js` holds the layout;
  the grid has a floor mask, so walls and the outside are simply "out of bounds" for every
  placement rule. The first wing converts the grid once into a 58×80 world that already reserves
  the hall's maximum size, so later hall expansions never move anything again. Old saves and
  players without wings are unchanged.
- **Decor** (`src/rendering/Decor.js`): a napping cat with Zzz, a robot vacuum in a chef's hat, a
  mouse that dashes out of its hole, a googly-eyed cupcake mascot, balloons, a gumball machine and a
  cake clock showing real time. Static parts are merged (`bakeStatic`) to keep draw calls low;
  machine models use the same merging.

## Known limitations (honest status)
- Rendering was **not** verified in a real GPU browser in this session (no network for Three.js
  in the build sandbox). Logic, UI flows, save/reload were verified headless with a Three.js stub,
  plus 49 unit tests. First thing to check: open the game and confirm visuals.
- `npm run build` was not executed here (packages could not be installed offline).
- Not yet: quarter cutter, CCW/180 rotator modes, selective-quadrant frosting and flavor unlocks
  via oven upgrades (Phase 3 upgrades), stacker + decorations + multi-layer orders (Phase 4),
  factory expansion (Phase 3), CrazyGames/Poki adapters (Phase 6), 100+ machine benchmark (Phase 7).
- Flavors/frostings unlock through orders for now; Phase 3 can move some behind oven upgrades.
- The camera can rotate, but cake previews in the UI are always drawn in the canonical
  orientation (top = −Z).
