// Solmar: a seeded coastal city on a street grid. The city is built once
// from a seed: roads, blocks, buildings, parks, the beach and the docks,
// plus the helpers the simulation uses (road tests, collisions, routes).
import { DISTRICTS, PALETTE, ROADS, WORLD } from './config.js';
import { clamp } from './random.js';

const ROAD_HALF = ROADS.width / 2;

/** Every intersection of the grid, plus the two beach-road ends. */
export function intersections(city) {
  const out = [];
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) out.push({ x, y });
  }
  out.push({ x: ROADS.vertical[0], y: ROADS.coastY });
  out.push({ x: ROADS.vertical[ROADS.vertical.length - 1], y: ROADS.coastY });
  return out;
}

export function createCity(random) {
  const city = {
    width: WORLD.width,
    height: WORLD.height,
    buildings: [],
    parks: [],
    trees: [],
    docks: [],
    lamps: [],
  };

  // Blocks: the rectangles between neighbouring roads. Each block gets
  // buildings, a park, or docks, by district and a seeded roll.
  const xs = [60, ...ROADS.vertical, WORLD.width - 60];
  const ys = [60, ...ROADS.horizontal, ROADS.coastY, WORLD.height - 40];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + ROAD_HALF + 14;
      const x1 = xs[i + 1] - ROAD_HALF - 14;
      const y0 = ys[j] + ROAD_HALF + 14;
      const y1 = ys[j + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = DISTRICTS.find((d) => cx >= d.x && cx < d.x + d.w && cy >= d.y && cy < d.y + d.h)
        || DISTRICTS[0];
      // The strip along the coast is the beach, not buildings.
      if (y0 > ROADS.coastY - 220) {
        if (random.chance(0.6)) {
          for (let t = 0; t < 5; t += 1) {
            city.trees.push({ x: random.range(x0, x1), y: random.range(y0, y1), r: random.range(9, 14) });
          }
        }
        continue;
      }
      // The far east strip is the container docks.
      if (x0 > 2620 && random.chance(0.75)) {
        for (let c = 0; c < 6; c += 1) {
          city.docks.push({
            x: random.range(x0, x1 - 90),
            y: random.range(y0, y1 - 34),
            w: random.range(60, 90),
            h: 30,
            color: random.pick(['#b3543f', '#3f6db3', '#c98a2e', '#4f8a4a', '#7a5fb0']),
          });
        }
        continue;
      }
      if (random.chance(0.16)) {
        city.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t += 1) {
          city.trees.push({ x: random.range(x0 + 16, x1 - 16), y: random.range(y0 + 16, y1 - 16), r: random.range(10, 16) });
        }
        continue;
      }
      // A block holds one to four buildings along its edges.
      const lots = random.int(1, 3);
      for (let l = 0; l < lots; l += 1) {
        const bw = random.range(90, Math.min(240, (x1 - x0) * 0.62));
        const bh = random.range(80, Math.min(200, (y1 - y0) * 0.62));
        const bx = random.range(x0, Math.max(x0, x1 - bw));
        const by = random.range(y0, Math.max(y0, y1 - bh));
        const floors = random.int(district.min, district.max);
        city.buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: random.pick(district.roofs),
          floors,
          district: district.name,
        });
      }
    }
  }

  // Lamp posts along the avenues, for the night-free afternoon glow.
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) {
      city.lamps.push({ x: x - ROAD_HALF - 8, y: y - ROAD_HALF - 8 });
      city.lamps.push({ x: x + ROAD_HALF + 8, y: y + ROAD_HALF + 8 });
    }
  }
  return city;
}

/** True when the segment between two points is not blocked by a building.
 * Sampled every 20 units — good enough for line-of-sight checks. */
export function hasLineOfSight(city, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(d / 20));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    for (const b of city.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
  }
  return true;
}

/** True when the point is on a road (or the beach road). */
export function isRoadAt(x, y) {
  for (const rx of ROADS.vertical) {
    if (Math.abs(x - rx) <= ROAD_HALF) return true;
  }
  for (const ry of ROADS.horizontal) {
    if (Math.abs(y - ry) <= ROAD_HALF) return true;
  }
  if (Math.abs(y - ROADS.coastY) <= ROAD_HALF) return true;
  return false;
}

/** True when the point is on the sand or in the sea (south of the beach road). */
export function isBeachAt(x, y) {
  return y > ROADS.coastY + ROAD_HALF;
}

/** The district name at a point, for the HUD. */
export function districtAt(x, y) {
  if (y > ROADS.coastY - 60) return 'Marina Beach';
  const d = DISTRICTS.find((dd) => x >= dd.x && x < dd.x + dd.w && y >= dd.y && y < dd.y + dd.h);
  return d ? d.name : 'Solmar';
}

/** The nearest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS.vertical) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 120, ROADS.coastY) }; }
  }
  for (const ry of ROADS.horizontal) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 120, WORLD.width - 120), y: ry }; }
  }
  const dc = Math.abs(y - ROADS.coastY);
  if (dc < bestD) best = { x: clamp(x, 120, WORLD.width - 120), y: ROADS.coastY };
  return best;
}

/** The nearest intersection to (x, y). */
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of intersections({})) {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * Push a circle out of every building it overlaps. Returns true when it hit
 * one. The circle's position is corrected in place; `radius` is its size.
 */
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    if (body.x + radius < b.x || body.x - radius > b.x + b.w
      || body.y + radius < b.y || body.y - radius > b.y + b.h) continue;
    // Push out along the smallest overlap.
    const left = body.x + radius - b.x;
    const right = b.x + b.w - (body.x - radius);
    const top = body.y + radius - b.y;
    const bottom = b.y + b.h - (body.y - radius);
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = b.x - radius;
    else if (m === right) body.x = b.x + b.w + radius;
    else if (m === top) body.y = b.y - radius;
    else body.y = b.y + b.h + radius;
    hit = true;
  }
  return hit;
}

/** Keep a point inside the city, with a margin. */
export function clampToCity(body, margin) {
  body.x = clamp(body.x, margin, WORLD.width - margin);
  body.y = clamp(body.y, margin, WORLD.height - margin);
}

/** A random point on a road, away from the given point when one is passed. */
export function randomRoadPoint(random, awayFrom, minDist) {
  for (let tries = 0; tries < 20; tries += 1) {
    const vertical = random.chance(0.5);
    const p = vertical
      ? { x: random.pick(ROADS.vertical), y: random.range(160, ROADS.coastY) }
      : { x: random.range(160, WORLD.width - 160), y: random.pick(ROADS.horizontal) };
    if (!awayFrom) return p;
    const d = Math.hypot(p.x - awayFrom.x, p.y - awayFrom.y);
    if (d >= (minDist || 400)) return p;
  }
  return { x: 1400, y: 1000 };
}

/** A random sidewalk point near a road, for pedestrians. */
export function randomSidewalkPoint(random) {
  const vertical = random.chance(0.5);
  if (vertical) {
    const rx = random.pick(ROADS.vertical);
    return { x: rx + (random.chance(0.5) ? -1 : 1) * (ROAD_HALF + 14), y: random.range(160, ROADS.coastY) };
  }
  const ry = random.pick(ROADS.horizontal);
  return { x: random.range(160, WORLD.width - 160), y: ry + (random.chance(0.5) ? -1 : 1) * (ROAD_HALF + 14) };
}

export { PALETTE };
