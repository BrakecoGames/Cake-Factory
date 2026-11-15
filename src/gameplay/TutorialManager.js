/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Event-driven onboarding. Every step waits for the PLAYER to do something
 * (or to press "Got it" on purely informational steps). Skipping only hides
 * the hints – the factory itself always starts in a valid playable state.
 */

export const TUTORIAL_STEPS = [
  {
    id: 'intro',
    title: "Let's bake your first cake!",
    text: 'This <b>oven</b> bakes vanilla cakes. Send them into the <b>Delivery Station</b> – it passes them to the <b>Cake Shop</b> counter, where the customer is waiting.',
    highlight: { world: ['oven', 'delivery'] },
    advance: 'button',
    button: 'Got it',
  },
  {
    id: 'connect',
    title: 'Connect the machines with conveyor belts.',
    text: 'Pick the <b>Conveyor</b> tool, then <b>drag</b> from the glowing arrow in front of the oven to the station.',
    highlight: { tool: 'belt', world: ['ovenOutput'] },
    advance: 'ovenConnected',
  },
  {
    id: 'watch',
    title: 'Here it comes!',
    text: 'Watch your cake ride the belt into the Delivery Station.',
    hintBlocked: 'Your belt ends before the station. Extend it so it touches the station.',
    advance: 'firstDelivery',
  },
  {
    id: 'progress',
    title: 'Delicious!',
    text: 'Each correct cake pays a little. Finish the order for the big reward.',
    advance: 'orderCompleted',
  },
  {
    id: 'reward',
    title: 'First order completed!',
    text: 'You earned the order reward. Spend money on more machines to take on bigger orders.',
    advance: 'button',
    button: 'Next order',
  },
  {
    id: 'frosting',
    title: 'New machine: Frosting Machine!',
    text: 'The next customer wants <b>pink frosted</b> cakes. Place a <b>Frosting Machine</b> in your line: oven → belt → froster → belt → station. Cakes enter on its back and leave from the front.',
    highlight: { tool: 'froster' },
    advance: 'frosterPlaced',
  },
];

export class TutorialManager {
  constructor() {
    this.step = 0;
    this.done = false;
    this.skipped = false;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.currentStep); }

  get active() { return !this.done; }
  get currentStep() { return this.done ? null : TUTORIAL_STEPS[this.step] ?? null; }

  /** Notify the tutorial that a gameplay signal happened. */
  signal(name) {
    if (this.done) return;
    // Signals can arrive early (e.g. a fast player). Advance through every
    // step that this signal (or an already reached state) satisfies.
    const cur = this.currentStep;
    if (cur && cur.advance === name) this.next();
  }

  next() {
    if (this.done) return;
    this.step++;
    if (this.step >= TUTORIAL_STEPS.length) this.done = true;
    this._emit();
  }

  skip() {
    this.done = true;
    this.skipped = true;
    this._emit();
  }

  serialize() { return { step: this.step, done: this.done, skipped: this.skipped }; }
  load(s) {
    if (!s) return;
    this.step = Math.max(0, Math.min(TUTORIAL_STEPS.length, s.step | 0));
    this.done = !!s.done || this.step >= TUTORIAL_STEPS.length;
    this.skipped = !!s.skipped;
  }
}
