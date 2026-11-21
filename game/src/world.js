// The world: everything the game simulates, in one state object. main.js
// boots it and paints it; shots.js stages it for screenshots. No DOM here
// except through the audio object it is given.
import { CAR, PALETTE, PED, POLICE, ROADS, TRAFFIC, WANTED, WORLD } from './config.js';
import { clamp, createRandom, dist } from './random.js';
import { createCity, clampToCity, collideBuildings, hasLineOfSight, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { MISSIONS, currentStep, missionText, missionWaypoint, startMissionState, updateMission } from './missions.js';
import { createArsenal, createBullets, createParticles, createPickups, burst, fireBullet, spawnPickup, startReload, tryPunch, tryShoot, updateArsenal, updateBullets, updateParticles, updatePickups } from './combat.js';
import { createCar, collideCar, collideCars, driveCar, drivePolice, driveTraffic, randomCarColor, spawnPolice, spawnTraffic } from './vehicles.js';
import { createFootCop, createGang, createPed, knockPed, updateFootCop, updateGang, updatePed } from './people.js';

export function createWorld(seed, saved) {
  const random = createRandom(seed);
  const city = createCity(random);
  const world = {
    seed,
    random,
    city,
    time: 0,
    cash: saved?.cash ?? 150,
    player: {
      x: 1000, y: 1800, angle: -Math.PI / 2,
      health: 100, armor: 0,
      car: null,
      aiming: false,
      speed: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    bullets: createBullets(),
    pickups: createPickups(),
    particles: createParticles(),
    arsenal: createArsenal(),
    wanted: { level: 0, heat: 0 },
    lastCrime: -99,
    policeTimer: 0,
    pickupTimer: 20,
    missionIndex: saved?.missionIndex ?? 0,
    completed: saved?.completed ? [...saved.completed] : [],
    mission: null,
    targetCar: null,
    waypoint: null,
    objective: '',
    toasts: [],
    camera: { x: 1000, y: 1800 },
    endState: null,
    stats: saved?.stats ?? { earned: 0, busted: 0, wasted: 0, carsStolen: 0, missionsDone: 0 },
    musicOn: saved?.musicOn ?? true,
  };
  // Opening traffic and pedestrians.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    world.cars.push(spawnTraffic(random, world.player, randomCarColor(random, PALETTE.carColors)));
  }
  for (let i = 0; i < PED.count; i += 1) {
    const p = randomSidewalkPoint(random);
    world.peds.push(createPed(p.x, p.y, random.pick(PALETTE.pedShirt)));
  }
  // A few pickups to find.
  spawnPickup(world.pickups, 700, 700, 'health');
  spawnPickup(world.pickups, 1500, 1500, 'ammo');
  spawnPickup(world.pickups, 2300, 900, 'cash', 250);
  spawnPickup(world.pickups, 1000, 2100, 'health');
  return world;
}

export function addToast(world, text, color) {
  world.toasts.push({ text, at: world.time, color: color || '#f2f4f6' });
  if (world.toasts.length > 4) world.toasts.shift();
}

export function addHeat(world, amount) {
  world.wanted.heat += amount;
  world.lastCrime = world.time;
  while (world.wanted.heat >= WANTED.heatPerLevel && world.wanted.level < WANTED.stars) {
    world.wanted.level += 1;
    world.wanted.heat -= WANTED.heatPerLevel;
  }
  if (world.wanted.level >= WANTED.stars) world.wanted.heat = Math.min(world.wanted.heat, WANTED.heatPerLevel);
}

function nearestCopDist(world) {
  let best = Infinity;
  for (const c of world.cars) {
    if (c.kind === 'police') best = Math.min(best, dist(c.x, c.y, world.player.x, world.player.y));
  }
  for (const c of world.cops) best = Math.min(best, dist(c.x, c.y, world.player.x, world.player.y));
  return best;
}

function copSeesPlayer(world) {
  const p = world.player;
  const range = WANTED.sightRange;
  for (const c of world.cars) {
    if (c.kind !== 'police') continue;
    if (dist(c.x, c.y, p.x, p.y) < range && hasLineOfSight(world.city, c.x, c.y, p.x, p.y)) return true;
  }
  for (const c of world.cops) {
    if (dist(c.x, c.y, p.x, p.y) < range && hasLineOfSight(world.city, c.x, c.y, p.x, p.y)) return true;
  }
  return false;
}

export function startMission(world, index, audio) {
  const def = MISSIONS[index];
  if (!def) return false;
  const mission = startMissionState(def);
  world.mission = mission;
  world.targetCar = null;
  // Stage the opening step.
  const step = def.steps[0];
  if (step.type === 'steal') {
    const car = createCar(step.x, step.y, 0, 'target', '#f2c230');
    world.cars.push(car);
    world.targetCar = car;
  }
  if (step.type === 'timed') mission.timer = step.seconds;
  if (step.type === 'kill') spawnGangSquad(world, step.x, step.y, step.count);
  addToast(world, `${def.title} — ${def.briefing}`, '#ffd23e');
  audio?.click();
  return true;
}

function spawnGangSquad(world, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const gx = x + world.random.range(-160, 160);
    const gy = y + world.random.range(-160, 160);
    world.gang.push(createGang(gx, gy));
  }
}

function completeMission(world, audio) {
  const mission = world.mission;
  if (!mission) return;
  world.cash += mission.def.reward;
  world.stats.earned += mission.def.reward;
  world.stats.missionsDone += 1;
  world.completed.push(mission.def.id);
  world.missionIndex = Math.min(MISSIONS.length, world.missionIndex + 1);
  addToast(world, `Job done — $${mission.def.reward.toLocaleString('en-US')} paid`, '#7ddc6a');
  audio?.jingle();
  world.mission = null;
  world.targetCar = null;
}

function failMission(world, audio, reason) {
  if (!world.mission) return;
  addToast(world, `Job failed — ${reason}. Press M to try again.`, '#ff5a4d');
  audio?.fail();
  world.mission = null;
  world.targetCar = null;
}

function enterCar(world, car, audio) {
  const player = world.player;
  player.car = car;
  car.driven = true;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  if (car.kind === 'target' || car.kind === 'police') {
    addHeat(world, car.kind === 'police' ? 55 : (copSeesPlayer(world) ? WANTED.stealCarSeen : WANTED.stealCar));
    addToast(world, car.kind === 'police' ? 'You stole a police car!' : 'Car stolen — the heat is on', '#ff5a4d');
  } else {
    addHeat(world, copSeesPlayer(world) ? WANTED.stealCarSeen : WANTED.stealCar);
    addToast(world, 'Car stolen', '#ffd23e');
  }
  world.stats.carsStolen += 1;
  audio?.click();
}

function exitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  car.driven = false;
  car.speed *= 0.3;
  const side = player.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 40;
  player.y = car.y + Math.sin(side) * 40;
  player.car = null;
}

function damagePlayer(world, amount, audio) {
  const player = world.player;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left * 0.6);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  if (player.health <= 0) {
    player.health = 0;
    world.endState = 'wasted';
    world.stats.wasted += 1;
    audio?.fail();
  }
}

/** One fixed step of the whole simulation. `c` is the controls object. */
export function stepWorld(world, c, dt, audio) {
  world.time += dt;
  const player = world.player;
  const random = world.random;

  // --- Player on foot ---
  if (!player.car) {
    const mv = c.move;
    const speed = mv.run ? 290 : 175;
    const moving = mv.x !== 0 || mv.y !== 0;
    player.speed = moving ? speed : 0;
    if (moving) {
      player.x += mv.x * speed * dt;
      player.y += mv.y * speed * dt;
      if (world.arsenal.current === 'fists') player.angle = Math.atan2(mv.y, mv.x);
    }
    // Aim with the mouse when armed.
    if (world.arsenal.current === 'pistol' && c.aim) {
      player.aiming = true;
      player.angle = Math.atan2(c.aim.y - player.y, c.aim.x - player.x);
    } else {
      player.aiming = false;
    }
    collideBuildings(world.city, player, 14);
    clampToCity(player, 24);

    if (c.enter) {
      let best = null;
      let bestD = 78;
      for (const car of world.cars) {
        if (car.damage >= 100) continue;
        const d = dist(player.x, player.y, car.x, car.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) enterCar(world, best, audio);
    }
    if (c.punch) {
      const targets = [
        ...world.gang.map((g) => ({ x: g.x, y: g.y, radius: 14, dead: g.health <= 0, hit: (dmg) => { g.health -= dmg; if (g.health <= 0) onGangDown(world, g, audio); } })),
        ...world.cops.map((cp) => ({ x: cp.x, y: cp.y, radius: 14, dead: false, hit: (dmg) => { addHeat(world, 20); } })),
        ...world.peds.map((pd) => ({ x: pd.x, y: pd.y, radius: 12, dead: pd.state === 'down', hit: () => { if (knockPed(pd)) addHeat(world, WANTED.hitPed); } })),
      ];
      const hit = tryPunch(world.arsenal, player.x, player.y, player.angle, targets);
      if (hit) audio?.punch();
    }
    if (c.shoot) {
      const result = tryShoot(world.arsenal, dt, world.bullets, player.x, player.y, player.angle);
      if (result === 'shot') {
        audio?.shot();
        if (copSeesPlayer(world)) addHeat(world, WANTED.shootNearCop);
      } else if (result === 'empty') {
        audio?.denied();
      }
    }
    if (c.reload) startReload(world.arsenal);
    if (c.weapon1) { world.arsenal.current = 'fists'; audio?.click(); }
    if (c.weapon2 && world.arsenal.hasPistol) { world.arsenal.current = 'pistol'; audio?.click(); }
  } else {
    // --- Player driving ---
    const car = player.car;
    driveCar(car, {
      throttle: c.move.y < 0,
      brake: c.move.y > 0,
      steer: c.move.x,
      handbrake: c.handbrake,
    }, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (collideCar(world.city, car)) {
      audio?.crash();
      burst(world.particles, car.x, car.y, '#888888', 6, 90);
    }
    if (car.damage >= 100) {
      addToast(world, 'The car is wrecked', '#ff5a4d');
      exitCar(world);
    }
    if (c.enter) exitCar(world);
    audio?.engine(Math.abs(car.speed) / 430, true);
  }
  updateArsenal(world.arsenal, dt);

  // --- Traffic ---
  const blockers = [...world.cars, ...world.peds.map((p) => ({ x: p.x, y: p.y }))];
  for (const car of world.cars) {
    if (car.driven) continue;
    if (car.kind === 'police') {
      drivePolice(car, player, dt, world.city);
      collideCar(world.city, car);
    } else {
      driveTraffic(car, dt, world.city, random, blockers);
      collideCar(world.city, car);
    }
  }
  // Car-car collisions.
  for (let i = 0; i < world.cars.length; i += 1) {
    for (let j = i + 1; j < world.cars.length; j += 1) {
      const a = world.cars[i];
      const b = world.cars[j];
      const impact = collideCars(a, b);
      if (impact > 120) {
        a.damage += impact * 0.08;
        b.damage += impact * 0.08;
        burst(world.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffcf4d', 8, 140);
        if (a.driven || b.driven) {
          audio?.crash();
          if (a.driven) damagePlayer(world, impact * 0.03, audio);
        }
      }
    }
  }
  // Player's car hitting pedestrians.
  if (player.car) {
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (dist(player.car.x, player.car.y, ped.x, ped.y) < 30 && Math.abs(player.car.speed) > 60) {
        if (knockPed(ped)) {
          addHeat(world, copSeesPlayer(world) ? WANTED.killPed : WANTED.hitPed);
          addToast(world, 'You hit a pedestrian!', '#ff5a4d');
          audio?.crash();
        }
      }
    }
  }

  // --- Wanted: decay and police presence ---
  const seen = copSeesPlayer(world);
  if (!seen && world.time - world.lastCrime > 8) {
    world.wanted.heat -= WANTED.decay * dt;
    if (world.wanted.heat < 0) {
      if (world.wanted.level > 0) {
        world.wanted.level -= 1;
        world.wanted.heat += WANTED.heatPerLevel;
      } else {
        world.wanted.heat = 0;
      }
    }
  }
  world.policeTimer -= dt;
  const wantCars = Math.min(world.wanted.level, POLICE.maxCars);
  const policeCars = world.cars.filter((c) => c.kind === 'police').length;
  if (policeCars < wantCars && world.policeTimer <= 0) {
    world.policeTimer = POLICE.spawnGap;
    world.cars.push(spawnPolice(random, player, PALETTE.police));
  }
  if (world.wanted.level === 0) {
    // Police drift away and leave.
    for (let i = world.cars.length - 1; i >= 0; i -= 1) {
      const car = world.cars[i];
      if (car.kind === 'police' && dist(car.x, car.y, player.x, player.y) > 900) world.cars.splice(i, 1);
    }
    for (let i = world.cops.length - 1; i >= 0; i -= 1) {
      if (dist(world.cops[i].x, world.cops[i].y, player.x, player.y) > 900) world.cops.splice(i, 1);
    }
  }
  const wantFoot = world.wanted.level >= 2 && !player.car ? Math.min(world.wanted.level, POLICE.maxFoot) : 0;
  if (world.cops.length < wantFoot && world.policeTimer <= 0) {
    const p = randomRoadPoint(random, player, 380);
    world.cops.push(createFootCop(p.x, p.y));
  }
  // Foot cops.
  for (const cop of world.cops) {
    const result = updateFootCop(cop, dt, player, world.wanted.level, random);
    if (result === 'punch') {
      damagePlayer(world, 8, audio);
      audio?.punch();
    } else if (result === 'bust') {
      world.endState = 'busted';
      world.stats.busted += 1;
      audio?.fail();
    }
  }

  // --- Pedestrians ---
  const danger = world.bullets.length > 0
    ? { x: world.bullets[0].x, y: world.bullets[0].y }
    : (player.car && Math.abs(player.car.speed) > 200 ? { x: player.x, y: player.y } : null);
  for (const ped of world.peds) updatePed(ped, dt, danger, random);
  // Keep the crowd around the player.
  if (world.peds.length < PED.count && random.chance(0.1)) {
    const p = randomSidewalkPoint(random);
    if (dist(p.x, p.y, player.x, player.y) > 400 && dist(p.x, p.y, player.x, player.y) < 1200) {
      world.peds.push(createPed(p.x, p.y, random.pick(PALETTE.pedShirt)));
    }
  }
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    if (dist(world.peds[i].x, world.peds[i].y, player.x, player.y) > 1500) world.peds.splice(i, 1);
  }
  // Keep traffic around the player.
  if (world.cars.filter((c) => c.kind !== 'police' && c.kind !== 'target').length < TRAFFIC.count && random.chance(0.1)) {
    world.cars.push(spawnTraffic(random, player, randomCarColor(random, PALETTE.carColors)));
  }
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.driven || car.kind === 'police' || car.kind === 'target') continue;
    if (dist(car.x, car.y, player.x, player.y) > 1700) world.cars.splice(i, 1);
  }

  // --- Gang ---
  for (let i = world.gang.length - 1; i >= 0; i -= 1) {
    const g = world.gang[i];
    if (g.health <= 0) { world.gang.splice(i, 1); continue; }
    const result = updateGang(g, dt, player);
    if (result === 'shoot') {
      const a = Math.atan2(player.y - g.y, player.x - g.x) + (random.next() - 0.5) * 0.24;
      fireBullet(world.bullets, g.x, g.y, a, 700, 7, 'enemy');
      audio?.shot();
    }
  }

  // --- Bullets ---
  const targets = [
    { x: player.x, y: player.y, radius: 14, dead: false, hit: (dmg, from) => { if (from !== 'player') damagePlayer(world, dmg, audio); } },
    ...world.gang.map((g) => ({ x: g.x, y: g.y, radius: 14, dead: g.health <= 0, hit: (dmg, from) => { if (from === 'player') { g.health -= dmg; if (g.health <= 0) onGangDown(world, g, audio); } } })),
    ...world.cops.map((cp) => ({ x: cp.x, y: cp.y, radius: 14, dead: false, hit: (dmg, from) => { if (from === 'player') addHeat(world, 15); } })),
    ...world.peds.map((pd) => ({ x: pd.x, y: pd.y, radius: 12, dead: pd.state === 'down', hit: (dmg, from) => { if (from === 'player' && knockPed(pd)) addHeat(world, WANTED.killPed); } })),
  ];
  updateBullets(world.bullets, dt, world.city, targets, world.particles);

  // --- Pickups ---
  updatePickups(world.pickups, dt, player, (p) => {
    if (p.kind === 'health') {
      player.health = Math.min(100, player.health + 40);
      addToast(world, '+40 health', '#7ddc6a');
    } else if (p.kind === 'armor') {
      player.armor = Math.min(100, player.armor + 50);
      addToast(world, '+50 armour', '#7db8e8');
    } else if (p.kind === 'ammo') {
      world.arsenal.reserve += 36;
      addToast(world, '+36 ammo', '#ffd23e');
    } else {
      world.cash += p.amount;
      world.stats.earned += p.amount;
      addToast(world, `+$${p.amount}`, '#ffd23e');
    }
    audio?.pickup();
  });

  updateParticles(world.particles, dt);

  // Pickups slowly restock so the player can patch up between jobs.
  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    world.pickupTimer = 20;
    if (world.pickups.length < 6) {
      const p = randomSidewalkPoint(random);
      const kind = random.pick(['health', 'ammo', 'armor', 'cash']);
      spawnPickup(world.pickups, p.x, p.y, kind, kind === 'cash' ? 100 : 0);
    }
  }

  // --- Mission ---
  if (world.mission) {
    const result = updateMission(world.mission, dt, {
      playerPos: { x: player.x, y: player.y },
      playerCar: player.car,
      targetCar: world.targetCar,
      gangAlive: world.gang.length,
      onEvent: (kind) => {
        if (kind === 'step') {
          addToast(world, 'Objective complete', '#7ddc6a');
          audio?.pickup();
          const step = currentStep(world.mission);
          if (step?.type === 'kill') spawnGangSquad(world, step.x, step.y, step.count);
          if (step?.type === 'timed') world.mission.timer = step.seconds;
        } else if (kind === 'reinforce') {
          spawnGangSquad(world, 1400, 1000, 1);
          addToast(world, "Voss's crew is moving in!", '#ff5a4d');
        }
      },
    });
    if (result === 'complete') completeMission(world, audio);
    else if (result === 'fail') failMission(world, audio, world.mission.failReason);
  }

  // Objective line and waypoint for the HUD.
  if (world.mission) {
    world.objective = `${world.mission.def.title}: ${missionText(world.mission)}`;
    world.waypoint = missionWaypoint(world.mission);
  } else if (world.missionIndex < MISSIONS.length) {
    world.objective = `Press M — next job: ${MISSIONS[world.missionIndex].title} ($${MISSIONS[world.missionIndex].reward})`;
    world.waypoint = null;
  } else {
    world.objective = 'Story complete — free roam Solmar';
    world.waypoint = null;
  }

  // Camera follows the player.
  const tx = player.x;
  const ty = player.y;
  world.camera.x += (tx - world.camera.x) * Math.min(1, 5 * dt);
  world.camera.y += (ty - world.camera.y) * Math.min(1, 5 * dt);
  world.camera.x = clamp(world.camera.x, 640, WORLD.width - 640);
  world.camera.y = clamp(world.camera.y, 360, WORLD.height - 360);

  // Siren loudness follows the nearest police.
  const near = nearestCopDist(world);
  audio?.siren(near === Infinity ? 0 : clamp(1 - near / 700, 0, 1));
  if (!player.car) audio?.engine(0, false);

  // Toasts age out (the HUD hides them after 3.2s).
  if (world.toasts.length > 0 && world.time - world.toasts[0].at > 3.2) world.toasts.shift();
}

function onGangDown(world, g, audio) {
  if (world.mission && currentStep(world.mission)?.type === 'kill') {
    world.mission.kills += 1;
  }
  world.cash += 50;
  spawnPickup(world.pickups, g.x, g.y, 'cash', 50);
  burst(world.particles, g.x, g.y, '#c93a4e', 10, 120);
  audio?.cash();
}

/** Respawn after busted or wasted: hospital / police station, lighter wallet. */
export function respawn(world) {
  const player = world.player;
  if (player.car) {
    player.car.driven = false;
    player.car = null;
  }
  const busted = world.endState === 'busted';
  player.x = busted ? 1400 : 1000;
  player.y = busted ? 600 : 1000;
  player.health = 100;
  player.armor = 0;
  player.angle = -Math.PI / 2;
  world.wanted.level = 0;
  world.wanted.heat = 0;
  world.cash = Math.max(0, Math.floor(world.cash * 0.9));
  world.gang.length = 0;
  world.cops.length = 0;
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    if (world.cars[i].kind === 'police') world.cars.splice(i, 1);
  }
  world.bullets.length = 0;
  if (world.mission) failMission(world, null, busted ? 'Busted' : 'Wasted');
  world.endState = null;
  world.camera.x = player.x;
  world.camera.y = player.y;
  addToast(world, busted ? 'Busted — the department kept 10%' : 'Wasted — patched up at the clinic', '#ff5a4d');
}
