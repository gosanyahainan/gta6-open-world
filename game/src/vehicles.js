// Cars: arcade physics for the player, road-following traffic, and police
// that chase. A car is a point with an angle and a speed; collisions are
// circles against buildings and other cars.
import { CAR, ROADS, WORLD } from './config.js';
import { angleDiff, clamp, dist } from './random.js';
import { collideBuildings, hasLineOfSight, isRoadAt, nearestRoadPoint, randomRoadPoint } from './city.js';

let nextId = 1;

function laneFor(axis, angle) {
  // Right-hand traffic: eastbound and northbound sit +24 off the centre line,
  // westbound and southbound sit -24 off it. (Screen y grows downward.)
  if (axis === 'h') return angle === 0 ? 24 : -24;
  return angle === Math.PI / 2 ? -24 : 24;
}

export function createCar(x, y, angle, kind, color) {
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    kind, // 'traffic' | 'police' | 'taxi' | 'target'
    color,
    damage: 0,
    driven: false,
    // Traffic state: which road line it follows and which way.
    axis: 'h',
    line: y,
    dir: 1,
    lane: 0, // right-hand lane offset from the road centre line
    wait: 0,
    // Police chase state.
    ramCooldown: 0,
  };
}

export function carRadius() {
  return 26;
}

/** A random parked or traffic car colour. */
export function randomCarColor(random, palette) {
  return random.pick(palette);
}

/** Step a driven car from player input. `drive` is {throttle, brake, steer, handbrake}. */
export function driveCar(car, drive, dt) {
  const maxSpeed = car.kind === 'police' ? CAR.policeSpeed : CAR.maxSpeed;
  if (drive.throttle) car.speed += CAR.accel * dt;
  if (drive.brake) {
    car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.7) * dt;
  }
  if (!drive.throttle && !drive.brake) {
    car.speed -= Math.sign(car.speed) * 120 * dt;
    if (Math.abs(car.speed) < 5) car.speed = 0;
  }
  if (drive.handbrake) {
    car.speed -= Math.sign(car.speed) * 420 * dt;
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);
  // Steering is full at parking speed and eases off as the car gets fast,
  // so a keyboard's all-or-nothing steer does not spin the car out.
  const turnRate = CAR.turn * clamp(140 / Math.max(140, Math.abs(car.speed)), 0.45, 1) * (drive.handbrake ? 1.5 : 1);
  car.angle += drive.steer * turnRate * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Step a traffic car along the grid: it follows its road line, and at an
 * intersection it may turn onto the crossing road. */
export function driveTraffic(car, dt, city, random, blockers) {
  if (car.wait > 0) {
    car.wait -= dt;
    car.speed = 0;
    return;
  }
  const target = CAR.trafficSpeed * (0.85 + 0.3 * ((car.id * 37) % 10) / 10);
  // Something ahead? Ease off (traffic keeps a gap).
  const aheadX = car.x + Math.cos(car.angle) * 62;
  const aheadY = car.y + Math.sin(car.angle) * 62;
  let blocked = false;
  for (const b of blockers) {
    if (dist(aheadX, aheadY, b.x, b.y) < 34) { blocked = true; break; }
  }
  car.speed += ((blocked ? 0 : target) - car.speed) * Math.min(1, 2.2 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn.
  const onV = ROADS.vertical.some((rx) => Math.abs(car.x - rx) < 12);
  const onH = ROADS.horizontal.some((ry) => Math.abs(car.y - ry) < 12);
  if (car.axis === 'h' && onV && random.chance(0.35)) {
    const rx = ROADS.vertical.find((v) => Math.abs(car.x - v) < 12);
    car.axis = 'v';
    car.line = rx;
    car.angle = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    car.dir = car.angle > 0 ? 1 : -1;
    car.lane = laneFor('v', car.angle);
    car.x = rx + car.lane;
  } else if (car.axis === 'v' && onH && random.chance(0.35)) {
    const ry = ROADS.horizontal.find((h) => Math.abs(car.y - h) < 12);
    car.axis = 'h';
    car.line = ry;
    car.angle = random.chance(0.5) ? 0 : Math.PI;
    car.dir = car.angle === 0 ? 1 : -1;
    car.lane = laneFor('h', car.angle);
    car.y = ry + car.lane;
  }
  // Keep it in its lane (it drifts a little at turns).
  if (car.axis === 'h') car.y += ((car.line + car.lane) - car.y) * Math.min(1, 3 * dt);
  else car.x += ((car.line + car.lane) - car.x) * Math.min(1, 3 * dt);

  // Off the map or beached: turn it around at the next intersection.
  if (car.x < 120 || car.x > WORLD.width - 120 || car.y < 120 || car.y > ROADS.coastY + 30) {
    car.angle += Math.PI;
    car.dir *= -1;
    car.x = clamp(car.x, 140, WORLD.width - 140);
    car.y = clamp(car.y, 140, ROADS.coastY);
  }
}

/** Step a police car: steer straight at the target, cutting across grass
 * when it must, slower off-road. If it cannot see the player it drives to
 * the last place it saw them and waits there — so breaking line of sight
 * (ducking behind a building) is a real way to lose the heat. */
export function drivePolice(car, target, dt, city) {
  const visible = hasLineOfSight(city, car.x, car.y, target.x, target.y);
  if (visible) {
    car.lastKnown = { x: target.x, y: target.y };
    car.lostT = 0;
  } else {
    car.lostT = (car.lostT || 0) + dt;
  }
  const goal = visible || !car.lastKnown ? target : car.lastKnown;
  const want = Math.atan2(goal.y - car.y, goal.x - car.x);
  const turn = angleDiff(car.angle, want);
  car.angle += clamp(turn, -2.4 * dt, 2.4 * dt);
  const offRoad = !isRoadAt(car.x, car.y);
  const max = (offRoad ? CAR.policeSpeed * 0.55 : CAR.policeSpeed) * (visible ? 1 : 0.6);
  car.speed += (max - car.speed) * Math.min(1, 1.4 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.ramCooldown > 0) car.ramCooldown -= dt;
}

/** Resolve a car against buildings and the city edge. Returns true on a hit. */
export function collideCar(city, car) {
  const hit = collideBuildings(city, car, 24);
  if (hit) car.speed *= 0.45;
  if (car.x < 60) { car.x = 60; car.speed *= 0.5; }
  if (car.x > WORLD.width - 60) { car.x = WORLD.width - 60; car.speed *= 0.5; }
  if (car.y < 60) { car.y = 60; car.speed *= 0.5; }
  if (car.y > WORLD.height - 60) { car.y = WORLD.height - 60; car.speed *= 0.5; }
  return hit;
}

/** Push two cars apart; returns the impact speed for sound and damage. */
export function collideCars(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = 52;
  if (d >= min || d === 0) return 0;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  const push = (min - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const swap = (a.speed + b.speed) / 2;
  a.speed = swap * 0.6;
  b.speed = swap * 0.6;
  return impact;
}

/** A fresh traffic car on a random road, away from the player. */
export function spawnTraffic(random, player, color) {
  const p = randomRoadPoint(random, player, 500);
  const vertical = random.chance(0.5);
  const angle = vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
  const car = createCar(p.x, p.y, angle, random.chance(0.08) ? 'taxi' : 'traffic', color);
  car.axis = vertical ? 'v' : 'h';
  car.line = vertical ? p.x : p.y;
  car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
  car.lane = laneFor(car.axis, angle);
  if (vertical) car.x = p.x + car.lane;
  else car.y = p.y + car.lane;
  car.speed = CAR.trafficSpeed * random.range(0.8, 1.05);
  return car;
}

/** A police car spawned at a road point near the player. */
export function spawnPolice(random, player, color) {
  const p = randomRoadPoint(random, player, 420);
  const car = createCar(p.x, p.y, 0, 'police', color);
  car.speed = CAR.policeSpeed * 0.6;
  return car;
}

export { nearestRoadPoint };
