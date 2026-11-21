// SOLMAR HEAT — boot, screens, the fixed-step loop and the save file.
// The simulation lives in world.js; this file owns the canvas, the input,
// the title/pause/busted/wasted overlays, and the `?shot=` screenshot mode.
import { MISSIONS } from './missions.js';
import { createWorld, respawn, startMission, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, drawHud } from './hud.js';
import { drawWorld } from './render.js';
import { stageShot } from './shots.js';
import { FONT, VIEW } from './config.js';

const SAVE_KEY = 'solmar-heat-save-v1';
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame(world, audio) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      missionIndex: world.missionIndex,
      completed: world.completed,
      stats: world.stats,
      musicOn: audio?.musicOn ?? true,
    }));
  } catch {
    // Private mode or a full quota: the game keeps working without a save.
  }
}

let audio = null;
try {
  audio = createAudio();
} catch {
  audio = null;
}

const saved = loadSave();
const world = createWorld(seed, saved);
const input = createInput(canvas);
const hud = createHud(world.city);
let screen = 'title'; // title | play | paused | busted | wasted | story
let menuIndex = 0;
let showHow = false;
let storyShown = false;
let saveTimer = 0;
let shotReadyFrames = 0;

function menuItems() {
  const items = [];
  if (saved && saved.missionIndex > 0) items.push({ id: 'continue', label: `Continue — ${MISSIONS[saved.missionIndex]?.title || 'free roam'}` });
  items.push({ id: 'new', label: 'New Game' });
  items.push({ id: 'how', label: 'How to Play' });
  return items;
}

function startPlay(fresh) {
  if (fresh) {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    const w2 = createWorld(seed, null);
    Object.assign(world, w2);
  }
  screen = 'play';
  if (audio) {
    audio.unlock();
    audio.startMusic();
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Build the controls object the world expects from the raw input. */
function buildControls() {
  const mv = input.move();
  const mouse = input.mouse();
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
  const offX = (rect.width - VIEW.width * scale) / 2;
  const offY = (rect.height - VIEW.height * scale) / 2;
  const viewX = (mouse.x - offX) / scale;
  const viewY = (mouse.y - offY) / scale;
  const aim = {
    x: world.camera.x - VIEW.width / 2 + viewX,
    y: world.camera.y - VIEW.height / 2 + viewY,
  };
  return {
    move: mv,
    enter: input.wasPressed('interact'),
    punch: input.wasPressed('attack'),
    shoot: mouse.down,
    shootPressed: mouse.clicked,
    reload: input.wasPressed('reload'),
    weapon1: input.wasPressed('weapon1'),
    weapon2: input.wasPressed('weapon2'),
    pause: input.wasPressed('pause'),
    confirm: input.wasPressed('confirm'),
    mission: input.wasPressed('mission'),
    handbrake: input.held('confirm'),
    aim,
  };
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function fitView() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(w / VIEW.width, h / VIEW.height);
  const ox = (w - VIEW.width * scale) / 2;
  const oy = (h - VIEW.height * scale) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  // Letterbox bars.
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(-ox / scale - 1, -oy / scale - 1, VIEW.width + (ox * 2) / scale + 2, (oy / scale) + 1);
  ctx.fillRect(-ox / scale - 1, VIEW.height, VIEW.width + (ox * 2) / scale + 2, (oy / scale) + 2);
  return scale;
}

function panel(ctx2, x, y, w, h) {
  ctx2.fillStyle = 'rgba(10,14,22,0.82)';
  ctx2.beginPath();
  ctx2.roundRect(x, y, w, h, 12);
  ctx2.fill();
  ctx2.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx2.lineWidth = 1;
  ctx2.stroke();
}

function drawTitle() {
  drawWorld(ctx, world, world.camera);
  ctx.fillStyle = 'rgba(8,12,20,0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 300, 96, 680, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 168);
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('An open-world street-crime game in the sun', VIEW.width / 2, 204);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText('Drive Solmar. Take jobs from Mara. Outrun the department.', VIEW.width / 2, 230);

  const items = menuItems();
  let y = 268;
  items.forEach((item, i) => {
    const selected = i === menuIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(255,176,46,0.18)';
      ctx.beginPath();
      ctx.roundRect(360, y - 20, 560, 34, 8);
      ctx.fill();
    }
    ctx.fillStyle = selected ? '#ffb02e' : '#e8ecf0';
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(item.label, VIEW.width / 2, y);
    y += 40;
  });
  ctx.textAlign = 'left';
  if (showHow) {
    panel(ctx, 300, 420, 680, 190);
    ctx.fillStyle = '#e8ecf0';
    ctx.font = `600 15px ${FONT}`;
    const lines = [
      'WASD / arrows — move or drive        Space — handbrake',
      'E — enter / exit a car (or steal one)',
      'Mouse — aim          Click — shoot          R — reload',
      '1 — fists        2 — pistol        F — punch',
      'M — start the next job        P — pause        H — horn',
      'Finish all five jobs to beat the story. Progress saves locally.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 330, 452 + i * 24));
  } else {
    ctx.fillStyle = '#9aa5b1';
    ctx.font = `400 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('↑ ↓ to choose, Enter to confirm — or click', VIEW.width / 2, 440);
    ctx.textAlign = 'left';
  }
}

function drawEndOverlay(title, sub, hint) {
  ctx.fillStyle = 'rgba(8,12,20,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 340, 230, 600, 220);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4d';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(title, VIEW.width / 2, 300);
  ctx.fillStyle = '#e8ecf0';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(sub, VIEW.width / 2, 340);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = `400 15px ${FONT}`;
  ctx.fillText(hint, VIEW.width / 2, 400);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 440, 250, 400, 180);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f4f6';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('Paused', VIEW.width / 2, 310);
  ctx.font = `400 15px ${FONT}`;
  ctx.fillStyle = '#9aa5b1';
  ctx.fillText('P or Esc to resume', VIEW.width / 2, 348);
  ctx.fillText('M — start the next job', VIEW.width / 2, 376);
  ctx.textAlign = 'left';
}

function drawStory() {
  ctx.fillStyle = 'rgba(8,12,20,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 280, 190, 720, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('THE SOLMAR JOB — DONE', VIEW.width / 2, 260);
  ctx.fillStyle = '#e8ecf0';
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('Jax got away clean. Mara pays in full.', VIEW.width / 2, 302);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText(`Total earned: $${world.stats.earned.toLocaleString('en-US')}   •   Cars stolen: ${world.stats.carsStolen}`, VIEW.width / 2, 336);
  ctx.fillText('Free roam continues — Solmar is yours now.', VIEW.width / 2, 366);
  ctx.fillText('Enter to keep playing', VIEW.width / 2, 420);
  ctx.textAlign = 'left';
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (shotName) {
    // Screenshot mode: one staged frame, then signal readiness.
    fitView();
    if (shotName === 'start') {
      drawTitle();
    } else {
      drawWorld(ctx, world, world.camera);
      drawHud(ctx, hud, world, VIEW.width, VIEW.height);
    }
    ctx.restore();
    shotReadyFrames += 1;
    if (shotReadyFrames >= 2) window.__shotReady = true;
    else requestAnimationFrame(frame);
    return;
  }

  if (screen === 'title') {
    // The city idles behind the menu.
    stepWorld(world, {
      move: { x: 0, y: 0, run: false },
      enter: false, punch: false, shoot: false, shootPressed: false,
      reload: false, weapon1: false, weapon2: false,
      pause: false, confirm: false, mission: false, handbrake: false, aim: null,
    }, dt, audio);
    const items = menuItems();
    if (input.wasPressed('up')) menuIndex = (menuIndex - 1 + items.length) % items.length;
    if (input.wasPressed('down')) menuIndex = (menuIndex + 1) % items.length;
    const mouse = input.mouse();
    let clickedItem = false;
    if (mouse.clicked) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
      const ox = (rect.width - VIEW.width * scale) / 2;
      const oy = (rect.height - VIEW.height * scale) / 2;
      const vx = (mouse.x - ox) / scale;
      const vy = (mouse.y - oy) / scale;
      items.forEach((item, i) => {
        if (vx >= 360 && vx <= 920 && vy >= 248 + i * 40 && vy <= 282 + i * 40) {
          menuIndex = i;
          clickedItem = true;
        }
      });
    }
    if (input.wasPressed('confirm') || clickedItem) {
      const item = items[menuIndex];
      if (item?.id === 'continue') startPlay(false);
      else if (item?.id === 'new') startPlay(true);
      else if (item?.id === 'how') showHow = !showHow;
    }
    fitView();
    drawTitle();
    ctx.restore();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (screen === 'play') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      const c = buildControls();
      if (c.pause) {
        screen = 'paused';
        break;
      }
      if (c.mission && !world.mission && world.missionIndex < MISSIONS.length) {
        startMission(world, world.missionIndex, audio);
      }
      stepWorld(world, c, STEP, audio);
      acc -= STEP;
      steps += 1;
    }
    if (steps === 4) acc = 0;
    if (world.endState === 'busted') screen = 'busted';
    else if (world.endState === 'wasted') screen = 'wasted';
    else if (!storyShown && world.missionIndex >= MISSIONS.length && world.completed.length >= MISSIONS.length) {
      storyShown = true;
      screen = 'story';
    }
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      saveGame(world, audio);
    }
    fitView();
    drawWorld(ctx, world, world.camera);
    drawHud(ctx, hud, world, VIEW.width, VIEW.height);
    ctx.restore();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (screen === 'paused') {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) screen = 'play';
    fitView();
    drawWorld(ctx, world, world.camera);
    drawHud(ctx, hud, world, VIEW.width, VIEW.height);
    drawPause();
    ctx.restore();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (screen === 'busted' || screen === 'wasted') {
    if (input.wasPressed('confirm')) {
      respawn(world);
      saveGame(world, audio);
      screen = 'play';
    }
    fitView();
    drawWorld(ctx, world, world.camera);
    drawHud(ctx, hud, world, VIEW.width, VIEW.height);
    drawEndOverlay(
      screen === 'busted' ? 'BUSTED' : 'WASTED',
      screen === 'busted' ? 'The department took its cut.' : 'Mara’s clinic patched you up.',
      'Press Enter to get back out there',
    );
    ctx.restore();
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (screen === 'story') {
    if (input.wasPressed('confirm')) screen = 'play';
    fitView();
    drawWorld(ctx, world, world.camera);
    drawHud(ctx, hud, world, VIEW.width, VIEW.height);
    drawStory();
    ctx.restore();
    input.endFrame();
    requestAnimationFrame(frame);
  }
}

// Screenshot mode: stage the scene, then paint it.
if (shotName) {
  if (shotName === 'start') {
    screen = 'title';
  } else {
    screen = 'play';
    stageShot(shotName, world, audio);
  }
  window.__shotReady = false;
  requestAnimationFrame(frame);
} else {
  announce('SOLMAR HEAT loaded. Press Enter to start.');
  requestAnimationFrame(frame);
}
