// Keyboard and mouse, read once a frame. Movement keys give a direction
// vector; action keys are edge-triggered (pressed this frame only).

const KEYMAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  attack: ['KeyF'],
  reload: ['KeyR'],
  weapon: ['Digit1', 'Digit2'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'],
  mission: ['KeyM'],
  horn: ['KeyH'],
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, right: false };

  function codeOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function held(name) {
    return KEYMAP[name].some((c) => down.has(c));
  }
  function wasPressed(name) {
    return KEYMAP[name].some((c) => pressed.has(c));
  }

  return {
    mouse,
    /** Normalised move vector from the movement keys. */
    move() {
      let x = 0;
      let y = 0;
      if (held('left')) x -= 1;
      if (held('right')) x += 1;
      if (held('up')) y -= 1;
      if (held('down')) y += 1;
      if (x !== 0 && y !== 0) {
        const s = Math.SQRT1_2;
        x *= s;
        y *= s;
      }
      return { x, y, run: held('run') };
    },
    held,
    wasPressed,
    /** The confirm key (Enter/Space) was pressed this frame. */
    confirmPressed() {
      return wasPressed('confirm');
    },
    /** Clear the edge-triggered presses; call once a frame after reading. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
