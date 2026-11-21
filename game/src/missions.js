// The story: Jax Moreno, wheelman for the fixer Mara Solano, working jobs
// across Solmar while Dante Voss's crew and the Solmar PD close in.
// A mission is a list of steps; the world runs one at a time.
import { MISSION_REWARD } from './config.js';
import { dist } from './random.js';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'First Pickup',
    reward: MISSION_REWARD[0],
    briefing: 'Mara needs a driver she can trust. Pick up her contact Ray at the Old Town corner and take him to the Marina. Drive clean — no heat.',
    steps: [
      { type: 'goto', x: 600, y: 600, radius: 60, label: 'Pick up Ray at the Old Town corner' },
      { type: 'goto', x: 1000, y: 1800, radius: 60, label: 'Drop Ray at the Marina' },
    ],
  },
  {
    id: 'drops',
    title: 'Three Drops',
    reward: MISSION_REWARD[1],
    briefing: 'Three packages, three corners, 150 seconds on the clock. Mara does not pay late.',
    steps: [
      { type: 'timed', seconds: 150, label: 'Deliver all three packages before the clock runs out', points: [
        { x: 1800, y: 600, label: 'Downtown drop' },
        { x: 2600, y: 1400, label: 'Docks drop' },
        { x: 600, y: 1800, label: 'Marina drop' },
      ] },
    ],
  },
  {
    id: 'borrowed',
    title: 'Borrowed Wheels',
    reward: MISSION_REWARD[2],
    briefing: 'Mara wants the yellow Comet parked outside the Downtown bank. Take it — the owner will call it in, so expect company. Deliver it to the Docks.',
    steps: [
      { type: 'steal', x: 1400, y: 1000, label: 'Steal the yellow Comet outside the bank' },
      { type: 'deliver', x: 2900, y: 1800, radius: 70, label: 'Deliver the Comet to the Docks' },
    ],
  },
  {
    id: 'blockwar',
    title: 'Block War',
    reward: MISSION_REWARD[3],
    briefing: "Voss's boys are holding the Old Town block. Clear them out, then get to the safehouse on the west side.",
    steps: [
      { type: 'kill', count: 4, x: 600, y: 1000, label: "Clear out Voss's crew (0/4)" },
      { type: 'goto', x: 400, y: 1400, radius: 60, label: 'Reach the safehouse' },
    ],
  },
  {
    id: 'job',
    title: 'The Solmar Job',
    reward: MISSION_REWARD[4],
    briefing: 'The big one. Crack the Downtown bank vault — hold the lobby 25 seconds while the drill works — then run for the boat at the Marina. Voss and the whole department will be there.',
    steps: [
      { type: 'goto', x: 1400, y: 1000, radius: 70, label: 'Reach the Downtown bank' },
      { type: 'hold', x: 1400, y: 1000, radius: 120, seconds: 25, label: 'Hold the bank lobby while the drill works' },
      { type: 'goto', x: 1000, y: 2280, radius: 70, label: 'Escape to the boat at the Marina' },
    ],
  },
];

/** A fresh runtime state for a mission. */
export function startMissionState(def) {
  return {
    def,
    step: 0,
    timer: 0,
    kills: 0,
    holdT: 0,
    visited: [],
    done: false,
    failed: false,
    failReason: '',
    spawnT: 0,
  };
}

export function currentStep(mission) {
  if (!mission) return null;
  return mission.def.steps[mission.step] || null;
}

/** The waypoint the HUD and minimap should point at, or null. */
export function missionWaypoint(mission) {
  const step = currentStep(mission);
  if (!step) return null;
  if (step.type === 'timed') {
    const next = step.points.find((p) => !mission.visited.includes(p));
    return next ? { x: next.x, y: next.y } : null;
  }
  if (step.type === 'kill') return { x: step.x, y: step.y };
  return { x: step.x, y: step.y };
}

/** The objective line for the HUD. */
export function missionText(mission) {
  const step = currentStep(mission);
  if (!step) return '';
  if (step.type === 'timed') {
    const left = step.points.length - mission.visited.length;
    return `${step.label} — ${left} left, ${Math.ceil(mission.timer)}s`;
  }
  if (step.type === 'kill') {
    return `Clear out Voss's crew (${mission.kills}/${step.count})`;
  }
  if (step.type === 'hold') {
    return `${step.label} — ${Math.ceil(step.seconds - mission.holdT)}s`;
  }
  return step.label;
}

/**
 * Advance a mission one tick. `api` is the world's helpers:
 * { playerPos, playerCar, targetCar, gangAlive, onEvent }.
 * Returns 'complete' | 'fail' | null.
 */
export function updateMission(mission, dt, api) {
  if (!mission || mission.done || mission.failed) return null;
  const step = currentStep(mission);
  if (!step) {
    mission.done = true;
    return 'complete';
  }
  const p = api.playerPos;
  if (step.type === 'goto' || step.type === 'deliver') {
    if (step.type === 'deliver' && api.playerCar !== api.targetCar) {
      // Lost the car: keep waiting at the point only if the car is near.
    }
    if (dist(p.x, p.y, step.x, step.y) < (step.radius || 60)) {
      if (step.type === 'deliver' && api.playerCar !== api.targetCar) return null;
      mission.step += 1;
      api.onEvent('step');
    }
    return null;
  }
  if (step.type === 'timed') {
    mission.timer -= dt;
    for (const pt of step.points) {
      if (!mission.visited.includes(pt) && dist(p.x, p.y, pt.x, pt.y) < 60) {
        mission.visited.push(pt);
        api.onEvent('step');
      }
    }
    if (mission.visited.length >= step.points.length) {
      mission.step += 1;
      return null;
    }
    if (mission.timer <= 0) {
      mission.failed = true;
      mission.failReason = 'Out of time';
      return 'fail';
    }
    return null;
  }
  if (step.type === 'steal') {
    if (api.playerCar === api.targetCar) {
      mission.step += 1;
      api.onEvent('step');
    }
    return null;
  }
  if (step.type === 'kill') {
    if (mission.kills >= step.count) {
      mission.step += 1;
      api.onEvent('step');
    }
    return null;
  }
  if (step.type === 'hold') {
    const inside = dist(p.x, p.y, step.x, step.y) < step.radius;
    if (inside) {
      mission.holdT += dt;
      mission.spawnT -= dt;
      if (mission.spawnT <= 0) {
        mission.spawnT = 8;
        api.onEvent('reinforce');
      }
      if (mission.holdT >= step.seconds) {
        mission.step += 1;
        api.onEvent('step');
      }
    } else {
      mission.holdT = Math.max(0, mission.holdT - dt * 0.5);
    }
    return null;
  }
  return null;
}
