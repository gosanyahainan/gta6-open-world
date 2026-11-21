// The people of Solmar: pedestrians who walk the sidewalks and run from
// trouble, foot police who patrol and chase, and gang members who shoot.
import { PED, POLICE } from './config.js';
import { angleTo, clamp, dist } from './random.js';
import { randomSidewalkPoint } from './city.js';

let nextId = 1;

export function createPed(x, y, shirt) {
  return {
    id: nextId,
    kind: 'ped',
    x, y,
    angle: 0,
    speed: 0,
    state: 'walk', // walk | flee | down
    target: null,
    wait: 0,
    fleeT: 0,
    downT: 0,
    shirt,
  };
}

export function createFootCop(x, y) {
  return {
    id: nextId,
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 0,
    state: 'patrol', // patrol | chase
    target: null,
    wait: 0,
    bustTimer: 0,
    punchT: 0,
  };
}

export function createGang(x, y) {
  return {
    id: nextId,
    kind: 'gang',
    x, y,
    angle: 0,
    speed: 0,
    state: 'guard', // guard | attack
    health: 50,
    shootT: 0,
    target: null,
    wait: 0,
  };
}

/** Step a pedestrian: wander the sidewalks, flee danger, get up after a fall. */
export function updatePed(ped, dt, danger, random) {
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.state = 'flee';
      ped.fleeT = 3;
    }
    return;
  }
  if (danger) {
    const d = dist(ped.x, ped.y, danger.x, danger.y);
    if (d < 260 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeT = 3.5;
    }
  }
  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    const away = angleTo(danger ? danger.x : ped.x, danger ? danger.y : ped.y, ped.x, ped.y);
    ped.angle = away;
    ped.speed = PED.run;
    ped.x += Math.cos(away) * ped.speed * dt;
    ped.y += Math.sin(away) * ped.speed * dt;
    if (ped.fleeT <= 0) ped.state = 'walk';
    return;
  }
  // Wandering.
  if (ped.wait > 0) {
    ped.wait -= dt;
    ped.speed = 0;
    return;
  }
  if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 18) {
    if (random.chance(0.25)) {
      ped.wait = random.range(1, 4);
      ped.speed = 0;
      return;
    }
    ped.target = randomSidewalkPoint(random);
  }
  const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
  ped.angle = a;
  ped.speed = PED.walk * random.range(0.8, 1.2);
  ped.x += Math.cos(a) * ped.speed * dt;
  ped.y += Math.sin(a) * ped.speed * dt;
}

/** Step a foot cop: patrol the beat, chase the player, hold them to bust. */
export function updateFootCop(cop, dt, player, wanted, random) {
  const d = dist(cop.x, cop.y, player.x, player.y);
  const playerDriving = !!player.car;
  const playerFast = playerDriving && Math.abs(player.car.speed) > 120;
  if (wanted > 0 && d < 560 && !playerFast) {
    cop.state = 'chase';
  } else if (cop.state === 'chase' && (d > 700 || wanted === 0)) {
    cop.state = 'patrol';
    cop.bustTimer = 0;
  }
  if (cop.state === 'chase') {
    const a = angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle = a;
    cop.speed = 240;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (d < 30) {
      cop.punchT -= dt;
      if (cop.punchT <= 0) {
        cop.punchT = 0.9;
        return 'punch'; // the caller deals the damage
      }
      // Holding a slow player builds the bust.
      if (!playerDriving || Math.abs(player.car.speed) < 40) {
        cop.bustTimer += dt;
        if (cop.bustTimer >= POLICE.bustTime) return 'bust';
      } else {
        cop.bustTimer = 0;
      }
    } else {
      cop.bustTimer = 0;
    }
    return null;
  }
  // Patrol: wander the sidewalks like anyone else.
  if (cop.wait > 0) {
    cop.wait -= dt;
    cop.speed = 0;
    return null;
  }
  if (!cop.target || dist(cop.x, cop.y, cop.target.x, cop.target.y) < 18) {
    if (random.chance(0.3)) {
      cop.wait = random.range(1, 3);
      return null;
    }
    cop.target = randomSidewalkPoint(random);
  }
  const a = angleTo(cop.x, cop.y, cop.target.x, cop.target.y);
  cop.angle = a;
  cop.speed = 70;
  cop.x += Math.cos(a) * cop.speed * dt;
  cop.y += Math.sin(a) * cop.speed * dt;
  return null;
}

/** Step a gang member: hold ground, then shoot at the player in range. */
export function updateGang(g, dt, player) {
  const d = dist(g.x, g.y, player.x, player.y);
  if (g.state === 'guard') {
    if (d < 380) g.state = 'attack';
    else {
      g.speed = 0;
      return null;
    }
  }
  // Attack: keep some distance and shoot.
  const a = angleTo(g.x, g.y, player.x, player.y);
  g.angle = a;
  if (d > 150) {
    g.speed = 130;
    g.x += Math.cos(a) * g.speed * dt;
    g.y += Math.sin(a) * g.speed * dt;
  } else if (d < 100) {
    g.speed = 110;
    g.x -= Math.cos(a) * g.speed * dt;
    g.y -= Math.sin(a) * g.speed * dt;
  } else {
    g.speed = 0;
  }
  g.shootT -= dt;
  if (g.shootT <= 0 && d < 420) {
    g.shootT = 0.85 + Math.random() * 0.5;
    return 'shoot';
  }
  return null;
}

/** Knock a pedestrian down (a car hit them). Returns true if it was a hit. */
export function knockPed(ped) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.downT = 3;
  return true;
}

export function spawnPedNear(random, player, shirt) {
  const p = randomSidewalkPoint(random);
  return createPed(p.x, p.y, shirt);
}
