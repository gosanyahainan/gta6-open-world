// Every tuning number and colour in one place. The world is a fixed logical
// city (3200 x 2400); the renderer scales a 1280 x 720 view of it to the
// window, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat.save.v1';

// The street grid: vertical avenues and horizontal streets, road width in units.
export const ROADS = {
  vertical: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  horizontal: [200, 600, 1000, 1400, 1800, 2200],
  width: 96,
  coastY: 2320, // the beach road along the south edge
};

// Districts, by rectangle: name, roof palette, building height range.
export const DISTRICTS = [
  { name: 'Downtown', x: 1200, y: 400, w: 1200, h: 800, min: 3, max: 6, roofs: ['#e07856', '#d95f4b', '#c94f5e', '#e0a458'] },
  { name: 'Old Town', x: 200, y: 400, w: 800, h: 800, min: 1, max: 2, roofs: ['#e8b04b', '#d98e32', '#c97e2e', '#e0c078'] },
  { name: 'Marina', x: 200, y: 1400, w: 1400, h: 800, min: 1, max: 3, roofs: ['#4fb3a9', '#3e9db4', '#63bfae', '#e07856'] },
  { name: 'Docks', x: 2600, y: 400, w: 600, h: 1800, min: 1, max: 2, roofs: ['#8b93a3', '#7a8296', '#9aa1b0', '#6b7280'] },
  { name: 'Hills', x: 200, y: 200, w: 2800, h: 200, min: 1, max: 2, roofs: ['#d97b6c', '#e0a458', '#c96a5a', '#d9b36c'] },
];

export const PLAYER = {
  radius: 14,
  walk: 175,
  run: 290,
  health: 100,
  punchRange: 46,
  punchDamage: 14,
  punchRate: 0.38,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 340,
  brake: 520,
  reverseMax: 150,
  maxSpeed: 430,
  trafficSpeed: 200,
  policeSpeed: 470,
  turn: 2.6,
  grip: 6.5,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, range: 46, rate: 0.38, auto: false },
  pistol: { name: 'Pistol', damage: 26, range: 460, rate: 0.22, mag: 12, reload: 1.1, auto: false, bulletSpeed: 900 },
};

export const WANTED = {
  stars: 5,
  heatPerLevel: 100,
  decay: 2.2, // heat lost per second while unseen
  stealCar: 22,
  stealCarSeen: 45,
  hitPed: 18,
  killPed: 42,
  shootNearCop: 12,
  killCop: 55,
  sightRange: 520,
};

export const POLICE = {
  maxCars: 4,
  maxFoot: 6,
  bustTime: 2.0, // seconds a foot cop must hold the player to bust them
  spawnGap: 3.0,
};

export const PED = { count: 46, walk: 55, run: 190, radius: 11 };

export const TRAFFIC = { count: 20, gap: 90 };

export const PALETTE = {
  grass: '#7fae5a',
  park: '#69a34e',
  sand: '#e8d29a',
  sea: '#2e7f9e',
  seaDeep: '#256b8a',
  asphalt: '#3a3f4a',
  asphaltDark: '#313642',
  sidewalk: '#9aa0a8',
  lane: '#e8e4d0',
  curb: '#c9cdd2',
  buildingShadow: 'rgba(0,0,0,0.28)',
  player: '#ffb02e',
  playerDark: '#e08e00',
  police: '#2f6fd6',
  policeDark: '#1d4f9e',
  gang: '#c93a4e',
  pedShirt: ['#e07856', '#4fb3a9', '#e8b04b', '#7d8fd4', '#c96a9a', '#8fbf6a', '#e0e0e0', '#5a6b7a'],
  carColors: ['#d94545', '#3f7fd4', '#e8b04b', '#e8e4d0', '#4a4f5a', '#7fb069', '#c96a9a', '#5a3d99'],
  taxi: '#f2c230',
  hudPanel: 'rgba(10, 16, 28, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#aab2bd',
  hudGold: '#ffcf4d',
  hudRed: '#ff5a4d',
  hudGreen: '#7ddc6a',
  waypoint: '#ffd23e',
  minimapRoad: '#565d6b',
  minimapBlock: '#232a36',
  minimapWater: '#256b8a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const MISSION_REWARD = [400, 900, 1500, 2200, 5000];
