// Combat: bullets, the player's weapons, pickups and particles. Bullets
// stop at buildings; pickups drift to the player; particles are pure show.
import { WEAPONS } from './config.js';
import { angleTo, dist } from './random.js';

export function createBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, speed, damage, from) {
  bullets.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.9,
    damage,
    from,
  });
}

/**
 * Step every bullet. `targets` is a list of {x, y, radius, hit(damage, from)}
 * objects (player, gang, cops, peds). Returns the hits for sound/effects.
 */
export function updateBullets(bullets, dt, city, targets, sparks) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const bd of city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          dead = true;
          sparks.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, color: '#ffd23e', size: 5 });
          break;
        }
      }
    }
    if (!dead) {
      for (const t of targets) {
        if (t.dead) continue;
        if (dist(b.x, b.y, t.x, t.y) < (t.radius || 14)) {
          dead = true;
          t.hit(b.damage, b.from);
          hits.push({ target: t, damage: b.damage, from: b.from });
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return hits;
}

/** The player's weapon state: which weapon, ammo, cooldowns. */
export function createArsenal() {
  return {
    current: 'pistol',
    ammo: WEAPONS.pistol.mag,
    reserve: 60,
    cooldown: 0,
    reloadT: 0,
    punchT: 0,
    hasPistol: true,
  };
}

export function weaponDef(arsenal) {
  return WEAPONS[arsenal.current];
}

/** Try to shoot toward `angle`. Returns 'shot' | 'empty' | 'reloading' | null. */
export function tryShoot(arsenal, dt, bullets, x, y, angle) {
  if (arsenal.reloadT > 0) return 'reloading';
  if (arsenal.cooldown > 0) return null;
  const def = WEAPONS[arsenal.current];
  if (arsenal.current === 'pistol') {
    if (arsenal.ammo <= 0) {
      startReload(arsenal);
      return 'empty';
    }
    arsenal.ammo -= 1;
    arsenal.cooldown = def.rate;
    fireBullet(bullets, x, y, angle, def.bulletSpeed, def.damage, 'player');
    return 'shot';
  }
  return null;
}

export function startReload(arsenal) {
  if (arsenal.current !== 'pistol' || arsenal.reloadT > 0) return;
  if (arsenal.ammo >= WEAPONS.pistol.mag || arsenal.reserve <= 0) return;
  arsenal.reloadT = WEAPONS.pistol.reload;
}

export function updateArsenal(arsenal, dt) {
  if (arsenal.cooldown > 0) arsenal.cooldown -= dt;
  if (arsenal.punchT > 0) arsenal.punchT -= dt;
  if (arsenal.reloadT > 0) {
    arsenal.reloadT -= dt;
    if (arsenal.reloadT <= 0) {
      const need = WEAPONS.pistol.mag - arsenal.ammo;
      const take = Math.min(need, arsenal.reserve);
      arsenal.ammo += take;
      arsenal.reserve -= take;
    }
  }
}

/** Try a punch at `angle` from (x, y); hits the first target in range. */
export function tryPunch(arsenal, x, y, angle, targets) {
  if (arsenal.punchT > 0) return null;
  arsenal.punchT = WEAPONS.fists.rate;
  for (const t of targets) {
    if (t.dead) continue;
    const d = dist(x, y, t.x, t.y);
    if (d > WEAPONS.fists.range + (t.radius || 14)) continue;
    const a = angleTo(x, y, t.x, t.y);
    let diff = Math.abs(a - angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.1) continue;
    t.hit(WEAPONS.fists.damage, 'player');
    return t;
  }
  return null;
}

export function createPickups() {
  return [];
}

export function spawnPickup(pickups, x, y, kind, amount) {
  pickups.push({ x, y, kind, amount: amount || 0, bob: 0 });
}

/** Pickups drift toward the player and are collected up close. */
export function updatePickups(pickups, dt, player, onCollect) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const p = pickups[i];
    p.bob += dt;
    const d = dist(p.x, p.y, player.x, player.y);
    if (d < 90) {
      const a = angleTo(p.x, p.y, player.x, player.y);
      p.x += Math.cos(a) * 160 * dt;
      p.y += Math.sin(a) * 160 * dt;
    }
    if (d < 26) {
      onCollect(p);
      pickups.splice(i, 1);
    }
  }
}

export function createParticles() {
  return [];
}

export function burst(particles, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + Math.random() * 0.8);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
