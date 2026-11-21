// Staged scenes for `?shot=`. Each one resets the world with a fixed seed,
// sets up a dramatic moment, and drives the simulation forward with a simple
// autopilot so the frame reads like gameplay — not a blank map.
// Used by main.js when the URL carries ?shot=.
import { startMission, stepWorld } from './world.js';
import { createGang } from './people.js';
import { ROADS } from './config.js';
import { dist } from './random.js';

const STEPS = 60;

/** A controls object with everything off. */
function idleControls() {
  return {
    move: { x: 0, y: 0, run: false },
    enter: false, punch: false, shoot: false, shootPressed: false,
    reload: false, weapon1: false, weapon2: false,
    pause: false, confirm: false, mission: false, handbrake: false,
    aim: null,
  };
}

function nearestLine(list, v) {
  return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

/** Grid route point: stay on roads and turn at intersections. */
function routePoint(car, tx, ty) {
  const rx = nearestLine(ROADS.vertical, car.x);
  const ry = nearestLine([...ROADS.horizontal, ROADS.coastY], car.y);
  const onV = Math.abs(car.x - rx) < 34;
  const onH = Math.abs(car.y - ry) < 34;
  const txV = nearestLine(ROADS.vertical, tx);
  const tyH = nearestLine([...ROADS.horizontal, ROADS.coastY], ty);
  if (onV && !onH) {
    if (rx === txV) return { x: rx, y: ty };
    return { x: rx, y: tyH };
  }
  if (onH && !onV) {
    if (ry === tyH) return { x: tx, y: ry };
    return { x: txV, y: ry };
  }
  if (onV && onH) {
    if (Math.abs(tx - car.x) > Math.abs(ty - car.y)) return { x: tx, y: ry };
    return { x: rx, y: ty };
  }
  const toV = { x: rx, y: car.y };
  const toH = { x: car.x, y: ry };
  return Math.hypot(toV.x - car.x, toV.y - car.y) < Math.hypot(toH.x - car.x, toH.y - car.y) ? toV : toH;
}

/** Steer a car toward a point, following roads when off them. */
function driveToward(world, tx, ty, dt) {
  const c = idleControls();
  const car = world.player.car;
  if (!car) return c;
  let rp = routePoint(car, tx, ty);
  // Right-hand lane, so the shot does not sideswipe oncoming traffic.
  const onVLine = ROADS.vertical.some((v) => Math.abs(rp.x - v) < 1);
  const onHLine = ROADS.horizontal.some((h) => Math.abs(rp.y - h) < 1) || Math.abs(rp.y - ROADS.coastY) < 1;
  if (onHLine && !onVLine) rp = { x: rp.x, y: rp.y + (rp.x >= car.x ? 24 : -24) };
  else if (onVLine && !onHLine) rp = { x: rp.x + (rp.y >= car.y ? -24 : 24), y: rp.y };
  const want = Math.atan2(rp.y - car.y, rp.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  c.move.x = Math.max(-1, Math.min(1, diff * 2.2));
  // Reverse if the target is behind us and we are slow.
  c.move.y = Math.abs(diff) > 2.4 && Math.abs(car.speed) < 60 ? 1 : -1;
  return c;
}

/** Walk the player toward a point. */
function walkToward(world, tx, ty) {
  const c = idleControls();
  const dx = tx - world.player.x;
  const dy = ty - world.player.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  c.move.x = dx / d;
  c.move.y = dy / d;
  c.move.run = true;
  return c;
}

/** Fire at the nearest gang member, if any is in range. */
function aimAtNearestGang(world) {
  let best = null;
  let bestD = 600;
  for (const g of world.gang) {
    const d = dist(world.player.x, world.player.y, g.x, g.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  if (!best) return null;
  return { x: best.x, y: best.y };
}

/** Run the world forward with the autopilot for `seconds` of game time. */
function simulate(world, audio, seconds, autopilot) {
  const steps = Math.round(seconds * STEPS);
  for (let i = 0; i < steps; i += 1) {
    const c = autopilot(world, 1 / STEPS);
    stepWorld(world, c, 1 / STEPS, audio);
    if (world.endState) break;
  }
}

export function stageShot(name, world, audio) {
  // Every shot starts from the same deterministic world.
  switch (name) {
    case 'cover': {
      // Mission 3: the stolen yellow Comet, three stars, two police cars closing in.
      startMission(world, 2, audio);
      const car = world.targetCar;
      world.player.car = car;
      car.driven = true;
      world.player.x = car.x;
      world.player.y = car.y;
      world.wanted.level = 3;
      world.wanted.heat = 40;
      world.camera.x = car.x;
      world.camera.y = car.y;
      simulate(world, audio, 9, (w) => driveToward(w, 2900, 1800, 1 / STEPS));
      break;
    }
    case 'street': {
      // Mission 2: on foot in the Marina, walking to the first drop.
      startMission(world, 1, audio);
      world.player.x = 1000;
      world.player.y = 1800;
      world.camera.x = 1000;
      world.camera.y = 1800;
      simulate(world, audio, 6, (w) => walkToward(w, 1800, 600));
      break;
    }
    case 'job': {
      // Mission 5: holding the bank lobby while Voss's crew closes in.
      startMission(world, 4, audio);
      // Jump to the hold step.
      world.mission.step = 1;
      world.player.x = 1400;
      world.player.y = 1000;
      world.wanted.level = 4;
      world.wanted.heat = 20;
      for (let i = 0; i < 3; i += 1) {
        world.gang.push(createGang(1400 + world.random.range(-200, 200), 1000 + world.random.range(-200, 200)));
      }
      world.arsenal.current = 'pistol';
      world.arsenal.ammo = 12;
      world.camera.x = 1400;
      world.camera.y = 1000;
      simulate(world, audio, 7, (w) => {
        const c = idleControls();
        const aim = aimAtNearestGang(w);
        if (aim) {
          c.aim = aim;
          c.shoot = true;
        }
        return c;
      });
      break;
    }
    default:
      // 'start' and anything else: the title screen over a living city.
      break;
  }
}
