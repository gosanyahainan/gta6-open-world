// The HUD: cash, health and armour, wanted stars, the objective line, the
// weapon readout, speed, and the minimap. The minimap's static city is
// painted once to an offscreen canvas; only the moving dots are drawn live.
import { PALETTE, VIEW, WANTED, WORLD } from './config.js';
import { FONT } from './config.js';
import { districtAt } from './city.js';

const MAP_W = 208;
const MAP_H = 156;

export function createHud(city) {
  const bg = document.createElement('canvas');
  bg.width = MAP_W;
  bg.height = MAP_H;
  const g = bg.getContext('2d');
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  g.fillStyle = PALETTE.minimapBlock;
  g.fillRect(0, 0, MAP_W, MAP_H);
  // Sea and sand along the south edge.
  g.fillStyle = PALETTE.minimapWater;
  g.fillRect(0, (2320 - 48) * sy, MAP_W, MAP_H - (2320 - 48) * sy);
  g.fillStyle = '#c9b078';
  g.fillRect(0, (2320 - 96) * sy, MAP_W, 96 * sy);
  // Roads.
  g.strokeStyle = PALETTE.minimapRoad;
  g.lineWidth = 4;
  for (const rx of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
    g.beginPath();
    g.moveTo(rx * sx, 0);
    g.lineTo(rx * sx, MAP_H);
    g.stroke();
  }
  for (const ry of [200, 600, 1000, 1400, 1800, 2200, 2320]) {
    g.beginPath();
    g.moveTo(0, ry * sy);
    g.lineTo(MAP_W, ry * sy);
    g.stroke();
  }
  // Parks and docks as blocks of green and grey.
  g.fillStyle = '#3f6b34';
  for (const p of city.parks) g.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy);
  g.fillStyle = '#4a505c';
  for (const d of city.docks) g.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy);
  return { bg, sx, sy };
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, frac))), h, 4);
  ctx.fill();
}

export function drawHud(ctx, hud, world, vw, vh) {
  const scaleX = vw / VIEW.width;
  const scaleY = vh / VIEW.height;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.font = `600 16px ${FONT}`;
  ctx.textBaseline = 'middle';

  const player = world.player;
  const cash = world.cash;

  // Top-left: cash, health, armour.
  panel(ctx, 16, 14, 250, 84);
  ctx.fillStyle = PALETTE.hudGold;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(`$${cash.toLocaleString('en-US')}`, 30, 34);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(districtAt(player.x, player.y).toUpperCase(), 30, 56);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('HP', 30, 78);
  bar(ctx, 58, 71, 100, 12, player.health / 100, player.health > 30 ? PALETTE.hudGreen : PALETTE.hudRed);
  ctx.fillText('ARM', 168, 78);
  bar(ctx, 198, 71, 54, 12, player.armor / 100, '#7db8e8');

  // Top-centre: wanted stars.
  const stars = world.wanted.level;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  let starText = '';
  for (let i = 0; i < WANTED.stars; i += 1) starText += i < stars ? '★' : '☆';
  ctx.fillStyle = stars > 0 ? PALETTE.hudRed : 'rgba(255,255,255,0.35)';
  ctx.fillText(starText, VIEW.width / 2, 32);
  ctx.textAlign = 'left';
  // Objective line under the stars.
  if (world.objective) {
    ctx.font = `600 14px ${FONT}`;
    const w = ctx.measureText(world.objective).width + 24;
    panel(ctx, VIEW.width / 2 - w / 2, 48, w, 26);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(world.objective, VIEW.width / 2, 62);
    ctx.textAlign = 'left';
  }

  // Top-right: minimap.
  const mx = VIEW.width - MAP_W - 16;
  const my = 14;
  panel(ctx, mx - 6, my - 6, MAP_W + 12, MAP_H + 12);
  ctx.drawImage(hud.bg, mx, my);
  const sx = hud.sx;
  const sy = hud.sy;
  // Mission waypoint, pulsing.
  if (world.waypoint) {
    const pulse = 5 + Math.sin(world.time * 5) * 2;
    ctx.fillStyle = PALETTE.waypoint;
    ctx.beginPath();
    ctx.arc(mx + world.waypoint.x * sx, my + world.waypoint.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Traffic as faint dots, police as blue, gang as red.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const c of world.cars) {
    if (c.kind === 'police') continue;
    ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
  }
  ctx.fillStyle = '#4d9fff';
  for (const c of world.cars) {
    if (c.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff5a4d';
  for (const g of world.gang) {
    ctx.beginPath();
    ctx.arc(mx + g.x * sx, my + g.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + player.x * sx, my + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Bottom-left: weapon and ammo.
  panel(ctx, 16, VIEW.height - 58, 210, 44);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `700 16px ${FONT}`;
  const weapon = world.arsenal.current === 'pistol' ? 'PISTOL' : 'FISTS';
  ctx.fillText(weapon, 30, VIEW.height - 36);
  if (world.arsenal.current === 'pistol') {
    ctx.fillStyle = world.arsenal.reloadT > 0 ? PALETTE.hudGold : PALETTE.hudMuted;
    ctx.font = `600 14px ${FONT}`;
    const ammo = world.arsenal.reloadT > 0 ? 'RELOADING' : `${world.arsenal.ammo} / ${world.arsenal.reserve}`;
    ctx.fillText(ammo, 120, VIEW.height - 36);
  }

  // Bottom-right: speed and driving hint.
  if (player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.32);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW.width - 46, VIEW.height - 40);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('km/h', VIEW.width - 16, VIEW.height - 40);
    ctx.textAlign = 'left';
  }

  // Toasts, centre, fading.
  ctx.textAlign = 'center';
  let ty = 120;
  for (const t of world.toasts) {
    const age = world.time - t.at;
    if (age > 3.2) continue;
    const alpha = age > 2.4 ? Math.max(0, 1 - (age - 2.4) / 0.8) : 1;
    ctx.globalAlpha = alpha;
    ctx.font = `700 19px ${FONT}`;
    const w = ctx.measureText(t.text).width + 28;
    panel(ctx, VIEW.width / 2 - w / 2, ty, w, 32);
    ctx.fillStyle = t.color || PALETTE.hudText;
    ctx.fillText(t.text, VIEW.width / 2, ty + 17);
    ty += 40;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Low-health vignette.
  if (player.health < 35) {
    const pulse = 0.16 + Math.sin(world.time * 6) * 0.06;
    const grad = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
    );
    grad.addColorStop(0, 'rgba(255,40,30,0)');
    grad.addColorStop(1, `rgba(255,40,30,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  // High-wanted red edge.
  if (world.wanted.level >= 4) {
    ctx.strokeStyle = 'rgba(255,60,45,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, VIEW.width - 6, VIEW.height - 6);
  }
  ctx.restore();
}
