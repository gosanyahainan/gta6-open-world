// The painter: ground, roads, beach and sea, parks, docks, buildings with
// sun shadows, cars, people, bullets, particles and mission markers.
// Everything is drawn from the world state each frame; the camera follows
// the player and is clamped to the city.
import { PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { FONT } from './config.js';

const ROAD_HALF = ROADS.width / 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, world, camera) {
  const vw = VIEW.width;
  const vh = VIEW.height;
  const ox = camera.x - vw / 2;
  const oy = camera.y - vh / 2;
  const vis = { x0: ox - 60, y0: oy - 60, x1: ox + vw + 60, y1: oy + vh + 60 };
  const inView = (x, y, m) => x > vis.x0 - (m || 0) && x < vis.x1 + (m || 0) && y > vis.y0 - (m || 0) && y < vis.y1 + (m || 0);

  ctx.save();
  ctx.translate(-ox, -oy);

  // Ground: grass, then the beach and the sea along the south edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vis.x0, ROADS.coastY + ROAD_HALF, vis.x1 - vis.x0, WORLD.height - ROADS.coastY - ROAD_HALF);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(vis.x0, ROADS.coastY + ROAD_HALF + 130, vis.x1 - vis.x0, WORLD.height - ROADS.coastY - ROAD_HALF - 130);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    const wy = ROADS.coastY + ROAD_HALF + 150 + i * 26;
    ctx.beginPath();
    for (let x = Math.max(0, vis.x0); x < vis.x1; x += 90) {
      const y = wy + Math.sin(x * 0.01 + world.time * 1.4 + i * 2) * 5;
      if (x === Math.max(0, vis.x0)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Parks.
  for (const p of world.city.parks) {
    if (!inView(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
    ctx.fillStyle = PALETTE.park;
    roundRect(ctx, p.x, p.y, p.w, p.h, 18);
    ctx.fill();
  }

  // Roads: asphalt, sidewalks, centre dashes.
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of ROADS.vertical) ctx.fillRect(rx - ROAD_HALF, 0, ROADS.width, ROADS.coastY + ROAD_HALF);
  for (const ry of ROADS.horizontal) ctx.fillRect(0, ry - ROAD_HALF, WORLD.width, ROADS.width);
  ctx.fillRect(0, ROADS.coastY - ROAD_HALF, WORLD.width, ROADS.width);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS.vertical) {
    ctx.fillRect(rx - ROAD_HALF, 0, 10, ROADS.coastY + ROAD_HALF);
    ctx.fillRect(rx + ROAD_HALF - 10, 0, 10, ROADS.coastY + ROAD_HALF);
  }
  for (const ry of ROADS.horizontal) {
    ctx.fillRect(0, ry - ROAD_HALF, WORLD.width, 10);
    ctx.fillRect(0, ry + ROAD_HALF - 10, WORLD.width, 10);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROADS.vertical) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, ROADS.coastY + ROAD_HALF);
    ctx.stroke();
  }
  for (const ry of ROADS.horizontal) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(WORLD.width, ry);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, ROADS.coastY);
  ctx.lineTo(WORLD.width, ROADS.coastY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Docks: containers.
  for (const d of world.city.docks) {
    if (!inView(d.x, d.y, 100)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(d.x + 4, d.y + 4, d.w, d.h);
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(d.x, d.y, d.w, 6);
  }

  // Buildings: sun shadow, roof, rooftop details.
  for (const b of world.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const sh = b.floors * 4;
    ctx.fillStyle = PALETTE.buildingShadow;
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 8, b.y + 8, Math.min(40, b.w - 16), Math.min(26, b.h - 16));
    if (b.floors >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w - 34, b.y + 12, 22, 16);
      ctx.fillRect(b.x + 12, b.y + b.h - 28, 26, 16);
    }
  }

  // Trees.
  for (const t of world.city.trees) {
    if (!inView(t.x, t.y, 30)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e8a3e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6aa84f';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission waypoint beacon.
  if (world.waypoint) {
    const w = world.waypoint;
    const pulse = 1 + Math.sin(world.time * 5) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PALETTE.waypoint;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PALETTE.waypoint;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.waypoint;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y - 64);
    ctx.lineTo(w.x - 12, w.y - 38);
    ctx.lineTo(w.x + 12, w.y - 38);
    ctx.closePath();
    ctx.fill();
    // A thin guide line from the player to the waypoint.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = PALETTE.waypoint;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(world.player.x, world.player.y);
    ctx.lineTo(w.x, w.y);
    ctx.stroke();
    ctx.restore();
  }

  // Pickups.
  for (const p of world.pickups) {
    if (!inView(p.x, p.y, 30)) continue;
    const bob = Math.sin(p.bob * 4) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (p.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e33f3f';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (p.kind === 'armor') {
      ctx.fillStyle = '#7db8e8';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, -6);
      ctx.lineTo(10, 4);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 4);
      ctx.lineTo(-10, -6);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#8a6d00';
      ctx.fillRect(-8, -6, 16, 3);
    } else {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d00';
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    }
    ctx.restore();
  }

  // Cars.
  for (const car of world.cars) {
    if (!inView(car.x, car.y, 90)) continue;
    drawCar(ctx, car, world.time);
  }

  // People.
  for (const p of world.peds) {
    if (!inView(p.x, p.y, 30)) continue;
    drawPerson(ctx, p, false);
  }
  for (const c of world.cops) {
    if (!inView(c.x, c.y, 30)) continue;
    drawPerson(ctx, c, true);
  }
  for (const g of world.gang) {
    if (!inView(g.x, g.y, 30)) continue;
    drawGang(ctx, g);
  }

  // The player.
  drawPlayer(ctx, world.player, world.time);

  // Bullets as tracers.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -30, -12, 64, 30, 8);
  ctx.fill();
  const body = car.kind === 'police' ? PALETTE.police : car.kind === 'taxi' ? PALETTE.taxi : car.color;
  ctx.fillStyle = body;
  roundRect(ctx, -32, -15, 64, 30, 9);
  ctx.fill();
  // Windows and roof.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -12, -12, 22, 24, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(8, -12, 4, 24);
  // Headlights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(30, -11, 3, 6);
  ctx.fillRect(30, 5, 3, 6);
  // Wheels.
  ctx.fillStyle = '#16181d';
  ctx.fillRect(-22, -18, 12, 5);
  ctx.fillRect(-22, 13, 12, 5);
  ctx.fillRect(12, -18, 12, 5);
  ctx.fillRect(12, 13, 12, 5);
  // Damage smoke.
  if (car.damage > 55) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(-18 + Math.sin(time * 9) * 3, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police light bar, flashing.
  if (car.kind === 'police') {
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-6, -16, 12, 4);
    ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-6, 12, 12, 4);
  }
  // The target car of the steal job gets a marker.
  if (car.kind === 'target') {
    ctx.fillStyle = PALETTE.waypoint;
    ctx.beginPath();
    ctx.arc(0, -30, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, p, isCop) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  const shirt = isCop ? '#2f6fd6' : p.shirt || '#e07856';
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(7, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#1d4f9e';
    ctx.beginPath();
    ctx.arc(7, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe6ee';
    ctx.fillRect(5, -5, 4, 10);
  }
  if (p.state === 'down') {
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGang(ctx, g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c93a4e';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(6, -3, 12, 6);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(7, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Health bar.
  ctx.rotate(-g.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-14, -20, 28, 4);
  ctx.fillStyle = '#ff5a4d';
  ctx.fillRect(-14, -20, 28 * Math.max(0, g.health / 50), 4);
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  const x = player.x;
  const y = player.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.angle);
  // Jacket, yellow so the player reads at a glance.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a4d00';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0.6, Math.PI - 0.6);
  ctx.fill();
  // Head and shoulders.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(8, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.arc(8, -1.5, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  // Aim line when armed.
  if (player.aiming) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(90, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // Ring under the player so they never get lost in a crowd.
  ctx.strokeStyle = 'rgba(255,176,46,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 19 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
}
