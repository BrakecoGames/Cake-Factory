/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Boot: platform → save → renderer → UI → loop.
 */
import { Game } from './core/Game.js';
import { GameLoop } from './core/GameLoop.js';
import { SAVE, COPYRIGHT, GAME_VERSION } from './core/Config.js';
import { SaveManager } from './storage/SaveManager.js';
import { StandaloneAdapter } from './platforms/StandaloneAdapter.js';
import { CrazyGamesAdapter, wantsCrazyGames } from './platforms/CrazyGamesAdapter.js';
import { AudioManager } from './audio/AudioManager.js';
import { UI } from './ui/UI.js';

const $ = (id) => document.getElementById(id);
const env = import.meta.env;
const DEV = env ? !!env.DEV : /debug/.test(location.hash);

function fatal(msg) {
  $('startScreen').classList.add('hidden');
  $('fatal').classList.remove('hidden');
  $('fatalText').textContent = msg;
}

async function boot() {
  console.info(`Cake Factory – Sweet Automation ${GAME_VERSION} · ${COPYRIGHT}`);
  let platform = null;
  if (wantsCrazyGames(env || {})) {
    const cg = new CrazyGamesAdapter();
    try { await cg.init(); platform = cg; } catch (e) { console.warn('CrazyGames SDK unavailable, continuing standalone', e); }
  }
  if (!platform) {
    platform = new StandaloneAdapter();
    try { await platform.init(); } catch (e) { console.warn('Platform init failed, continuing standalone', e); }
  }
  platform.loadingStart();

  const game = new Game();
  const saves = new SaveManager(platform.storage, SAVE.STORAGE_KEY);
  game.saveManager = saves;

  // ---- load (before anything can write) ------------------------------
  const loaded = await saves.loadGame();
  let loadNote = '';
  if (loaded.ok) {
    try {
      const problems = game.loadState(loaded.state);
      if (problems.length) console.warn('Save loaded with problems:', problems);
      loadNote = `Welcome back! Level ${game.level} · $${Math.floor(game.economy.money).toLocaleString('en-US')}`;
    } catch (e) {
      console.error('Applying save failed', e);
      await platform.storage.setItem(SAVE.BACKUP_KEY, JSON.stringify(loaded.state)).catch(() => {});
      game.newGame();
      loadNote = 'Your save could not be restored – a backup was kept. Starting fresh.';
    }
  } else if (loaded.corrupt) {
    loadNote = loaded.reason;
  }

  // ---- renderer (graceful WebGL failure) ------------------------------
  let THREEmods;
  try {
    THREEmods = await Promise.all([
      import('./rendering/SceneManager.js'),
      import('./rendering/CameraController.js'),
      import('./rendering/FactoryRenderer.js'),
      import('./input/InputController.js'),
    ]);
  } catch (e) {
    console.error(e);
    fatal('The game files could not be loaded. Please check your connection and refresh.');
    return;
  }
  const [{ SceneManager, detectQuality }, { CameraController }, { FactoryRenderer }, { InputController }] = THREEmods;

  // 3D signs are drawn on canvases once: make sure the brand font is ready (max 1.5 s).
  try {
    await Promise.race([document.fonts?.load('bold 40px "Fredoka"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* system font fallback */ }

  let sm;
  try {
    sm = new SceneManager($('viewport'));
  } catch (e) {
    console.error(e);
    fatal('Your browser could not start WebGL graphics. Try enabling hardware acceleration or using a current version of Chrome, Edge, Firefox or Safari.');
    return;
  }

  const camera = new CameraController(innerWidth, innerHeight);
  sm.camera = camera;
  const applyQuality = () => sm.setQuality(game.settings.quality === 'auto' ? detectQuality() : game.settings.quality);
  applyQuality();
  const audio = new AudioManager();
  const fr = new FactoryRenderer(sm, game);
  const ui = new UI({ game, audio, camera, canvas: sm.canvas });
  const input = new InputController({ canvas: sm.canvas, game, camera, renderer: fr, audio, ui });
  ui.attachInput(input);
  ui.onHighlight = (list) => fr.setHighlights(list);
  fr.shop.onCustomerArrived = (order) => {
    if (!started) return;
    audio.play('bell');
    ui.toast(`New order: ${order.name} (×${order.quantity}) from ${order.customer}`, 'good');
  };
  ui.worldToScreen = ({ gx, gy, h }) => camera.project(fr.gridToWorld(gx, gy, h), sm.canvas.getBoundingClientRect());

  const frameCamera = () => {
    camera.setBounds(game.sim.width / 2, game.sim.height / 2);
    const fit = Math.min(1.25, Math.max(0.6, 18 / Math.max(game.sim.width, game.sim.height)));
    camera.focus(1.5, 0, innerWidth < 820 ? fit * 0.85 : fit);
  };
  frameCamera();
  camera.target.copy(camera.goal); camera.zoom = camera.goalZoom;
  /** Fit every machine (or the starter pair) into the screen area that UI panels leave free. */
  const frameFactory = () => {
    const pts = [];
    for (const e of game.sim.entities.values()) {
      if (e.kind !== 'machine') continue;
      const [w, h] = e.size;
      for (const [gx, gy] of [[e.x, e.y], [e.x + w, e.y], [e.x, e.y + h], [e.x + w, e.y + h]]) pts.push(fr.gridToWorld(gx, gy, 0), fr.gridToWorld(gx, gy, 1.4));
    }
    // During the tutorial the customer at the Cake Shop counter is part of the story: keep it in view.
    if (game.tutorial.active) { const c = fr.shop.standPos; pts.push(c.clone(), c.clone().setY(2.6)); }
    // An empty factory (everything removed): frame the whole floor instead.
    if (!pts.length) {
      const W = game.sim.width, H = game.sim.height;
      pts.push(fr.gridToWorld(0, 0, 0), fr.gridToWorld(W, 0, 0), fr.gridToWorld(0, H, 0), fr.gridToWorld(W, H, 0));
    }
    camera.setBounds(game.sim.width / 2, game.sim.height / 2);
    // Extra margin (in cells) so the line between the machines is easy to hit.
    const grow = 1.5, mid = pts.reduce((a, p) => a.add(p), pts[0].clone().multiplyScalar(0)).multiplyScalar(1 / Math.max(1, pts.length));
    for (const p of pts) { p.x += Math.sign(p.x - mid.x) * grow; p.z += Math.sign(p.z - mid.z) * grow; }
    camera.frame(pts, ui.freeRect(), sm.canvas.getBoundingClientRect(), innerWidth < 820 ? 1.6 : 1.25);
  };
  game.bus.on('factoryResized', () => camera.setBounds(game.sim.width / 2, game.sim.height / 2));
  game.bus.on('reset', () => camera.setBounds(game.sim.width / 2, game.sim.height / 2));

  const applySettings = () => {
    audio.setVolume(game.settings.volume);
    audio.setMusic(game.settings.music ?? 0.5);
    audio.setMuted(game.settings.muted || platform.muteAudio);
  };
  platform.onSettingsChange(() => applySettings());
  game.bus.on('orderCompleted', () => platform.happytime());
  applySettings();
  ui.onSettingsChange = () => { applySettings(); applyQuality(); game.requestSave(); };

  // ---- save status ------------------------------------------------------
  saves.onStatus = (s) => ui.setSaveStatus(s, platform.persistent);
  ui.setSaveStatus(saves.status, platform.persistent);

  // ---- loop -------------------------------------------------------------
  let started = false;
  const diag = { el: $('debug'), t: 0 };
  if (DEV) { diag.el.classList.remove('hidden'); window.__cakeFactory = { game, input, camera, fr, ui }; }
  const loop = new GameLoop({
    update: () => { if (started) game.fixedUpdate(); },
    render: (dt, alpha) => {
      camera.update(dt);
      input.update();
      fr.render(dt, started ? alpha : 1, camera.azimuth);
      sm.render(camera.camera);
      sm.trackFps(dt);
      ui.update(dt);
      if (DEV) {
        diag.t -= dt;
        if (diag.t <= 0) {
          diag.t = 0.5;
          const c = game.sim.counts();
          diag.el.textContent = `FPS ${(1 / Math.max(dt, 1e-3)).toFixed(0)}  sim ${loop.simMs.toFixed(2)} ms\nmachines ${c.machines}  belts ${c.belts}  items ${c.items}\ndraw calls ${sm.renderer.info.render.calls}  px ${sm.renderer.getPixelRatio().toFixed(2)}\nsave ${saves.status}  quality ${sm.quality}`;
        }
      }
    },
  });
  loop.start();

  const setPaused = (p) => {
    loop.paused = p;
    ui.setPaused(p);
    if (p) platform.gameplayStop(); else platform.gameplayStart();
  };
  ui.onPauseToggle = () => { if (started) setPaused(!loop.paused); };

  ui.onResetProgress = async () => {
    await saves.deleteSave();
    game.newGame();
    frameCamera();
    input.setTool('select');
    if (started) requestAnimationFrame(frameFactory);
    await game.saveNow();
    ui.toast('Progress reset – a fresh bakery awaits!', 'good');
  };

  // ---- lifecycle --------------------------------------------------------
  setInterval(() => { if (started) game.saveNow(); }, SAVE.AUTOSAVE_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (started) game.saveNow();
      audio.suspend();
      platform.gameplayStop();
    } else {
      audio.resume();
      if (started && !loop.paused) platform.gameplayStart();
    }
  });
  window.addEventListener('pagehide', () => { if (started) game.saveNow(); });
  sm.onContextLost = () => { loop.paused = true; ui.toast('Graphics context lost – restoring…', 'bad'); };
  sm.onContextRestored = () => { fr.fullSync(); loop.paused = false; ui.toast('Graphics restored', 'good'); };

  // ---- start screen ----------------------------------------------------
  platform.loadingStop();
  const hasProgress = loaded.ok;
  $('btnPlay').textContent = hasProgress ? 'Continue' : 'Play';
  $('btnNewGame').classList.toggle('hidden', !hasProgress);
  $('startInfo').textContent = loadNote;
  const begin = () => {
    audio.unlock();
    audio.play('click');
    audio.startMusic();
    $('startScreen').classList.add('hidden');
    ui.showGame();
    started = true;
    // Panels are laid out now: frame the factory into the space they leave free.
    requestAnimationFrame(frameFactory);
    platform.gameplayStart();
    if (!platform.persistent) ui.toast('Browser storage is unavailable – progress will not be saved', 'bad');
  };
  $('btnPlay').addEventListener('click', begin);
  $('btnNewGame').addEventListener('click', () => {
    ui.confirm('Start a new game?', 'Your current factory and progress will be replaced.', 'New game', async () => {
      await ui.onResetProgress();
      begin();
    });
  });
}

boot().catch((e) => { console.error(e); fatal(`Something went wrong while starting the game: ${e.message || e}`); });
