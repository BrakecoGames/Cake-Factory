/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Central tunables. Simulation code reads from here; nothing in this file
 * depends on Three.js or the DOM.
 */

export const GAME_TITLE = 'Cake Factory – Sweet Automation';
export const COPYRIGHT = '© 2026 Brakeco Games';
export const GAME_VERSION = '1.0.0';

export const SIM = {
  /** Fixed simulation rate. 30 ticks/s keeps belts smooth with interpolation. */
  TICK_RATE: 30,
  get DT() { return 1 / this.TICK_RATE; },
  /** Hard cap on catch-up ticks per rendered frame (prevents spiral of death). */
  MAX_TICKS_PER_FRAME: 8,
};

export const GRID = {
  START_WIDTH: 20,
  START_HEIGHT: 20,
};

export const BELT = {
  /** Cells per second an item travels on a basic belt. */
  SPEED: 1.6,
  /**
   * Minimum distance (in cells) between the centres of two cakes travelling
   * along a belt line. Prevents visual overlap at cell boundaries.
   */
  MIN_SPACING: 0.72,
  COST: 5,
};

export const ECONOMY = {
  START_MONEY: 500,
  /** Fraction of purchase price returned when an entity is removed. */
  REFUND_RATE: 1.0,
};

export const SAVE = {
  FORMAT_VERSION: 4,
  AUTOSAVE_INTERVAL_MS: 30000,
  DEBOUNCE_MS: 1200,
  STORAGE_KEY: 'brakeco.cakefactory.save',
  BACKUP_KEY: 'brakeco.cakefactory.save.corrupt-backup',
};

export const MAX_CAKE_LAYERS = 4;

/** Rendering constants shared by models and conveyors (no gameplay effect). */
export const RENDER = {
  /** Height of the conveyor belt surface; cakes ride at this height. */
  BELT_SURF: 0.24,
};

/** Phase 3 tycoon tuning. Index = level - 1 (levels 1..5). */
export const UPGRADES = {
  MAX_LEVEL: 5,
  /** Machine speed multiplier per level (bake / process time is divided by it). */
  SPEED: [1, 1.25, 1.55, 1.9, 2.4],
  /** Cost to go from level i+1 to i+2, as a fraction of the machine's price. */
  COST_FACTOR: [0.75, 1.5, 3, 6],
  /** Finished cakes an oven can hold while its exit is busy. */
  OVEN_BUFFER: [1, 1, 2, 2, 3],
  /** Machine-specific features unlocked by level. */
  FEATURES: {
    rotator: { 2: 'Counter-clockwise turning', 3: '180° turning' },
    froster: { 3: 'Frost selected quadrants only' },
    decorator: { 3: 'Decorate selected quadrants only' },
  },
};

/** Factory-wide upgrades bought in the Bakery Upgrades panel. */
export const GLOBAL_UPGRADES = {
  belt: {
    name: 'Faster Conveyors', desc: 'All belts and machine belts move faster.',
    values: [1, 1.2, 1.4, 1.65, 1.9], costs: [300, 900, 2200, 5000], unit: '×',
  },
  reputation: {
    name: 'Bakery Reputation', desc: 'Customers pay more for every correct cake.',
    values: [1, 1.1, 1.2, 1.35, 1.5], costs: [400, 1100, 2600, 6000], unit: '×',
  },
  size: {
    name: 'Factory Expansion', desc: 'More floor space: the factory grows on every side.',
    values: [20, 24, 28, 32, 36], costs: [1500, 4000, 9000, 18000], unit: 'cells',
  },
};
