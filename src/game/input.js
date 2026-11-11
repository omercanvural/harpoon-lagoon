// Turns mouse, keyboard and gamepads into two simple player controllers.
//
// Player 1 (blue, left):    mouse  (+ gamepad 1 when two pads are plugged in)
// Player 2 (orange, right): keyboard (+ the only gamepad when one pad is plugged in,
//                           or gamepad 2 when two are)
// So any mix works: 2 pads, 1 pad + mouse, or mouse + keyboard.

const FIRE_BUTTONS = [0, 1, 2, 3, 5, 7]; // A B X Y, right bumper, right trigger
const PAUSE_BUTTONS = [8, 9]; // back/select, start

function freshState() {
  return {
    fireDown: false,
    firePressed: false,
    fireReleased: false,
    stickAngle: null, // absolute aim from a stick, radians, 0 = straight ahead
    aimDelta: 0, // -1..1 turn input from keys / d-pad
    pointer: null, // {x, y} in normalised device coords when the mouse is aiming
    navX: 0, // -1 / +1 on the frame a left/right was pressed (menus)
    pressedAny: false,
    usingPad: false,
  };
}

export class Input {
  constructor(element) {
    this.keys = new Set();
    this.keysPressed = new Set();
    this.mouseDown = false;
    this.mousePressed = false;
    this.pointer = null;
    this.pointerMovedAt = -1;
    this.prevFire = [false, false];
    this.prevNav = [0, 0];
    this.prevPadButtons = new Map();
    this.pausePressed = false;
    this.mouseClicked = false;
    this.frame = 0;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.keysPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    element.addEventListener('pointermove', (e) => {
      const r = element.getBoundingClientRect();
      this.pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      this.pointerMovedAt = this.frame;
    });
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mousePressed = true;
      const r = element.getBoundingClientRect();
      this.pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      this.pointerMovedAt = this.frame;
    });
    window.addEventListener('pointerup', () => (this.mouseDown = false));
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pads() {
    const list = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    return list.filter((p) => p && p.connected);
  }

  // Which device each player is using, for the picture hints in the menus.
  devices() {
    const n = this.pads().length;
    return {
      p1: n >= 2 ? 'gamepad' : 'mouse',
      p2: n >= 1 ? 'gamepad' : 'keyboard',
    };
  }

  padPressed(pad, index) {
    const key = `${pad.index}:${index}`;
    const down = !!pad.buttons[index]?.pressed;
    const was = this.prevPadButtons.get(key) ?? false;
    this.prevPadButtons.set(key, down);
    return down && !was;
  }

  readPad(pad, s) {
    if (!pad) return;
    const fire = FIRE_BUTTONS.some((i) => pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.5);
    if (fire) s.fireDown = true;
    for (const i of PAUSE_BUTTONS) if (this.padPressed(pad, i)) this.pausePressed = true;
    for (const i of FIRE_BUTTONS) if (this.padPressed(pad, i)) s.pressedAny = true;
    if (s.pressedAny) s.pressEvent = true;

    // Either stick aims: push it where you want to shoot.
    for (const [ax, ay] of [[0, 1], [2, 3]]) {
      const x = pad.axes[ax] ?? 0;
      const y = pad.axes[ay] ?? 0;
      if (Math.hypot(x, y) > 0.45) {
        s.stickAngle = Math.atan2(x, -y);
        s.usingPad = true;
        break;
      }
    }
    if (pad.buttons[14]?.pressed) s.aimDelta -= 1;
    if (pad.buttons[15]?.pressed) s.aimDelta += 1;
    const sx = pad.axes[0] ?? 0;
    s.navRaw = (s.navRaw ?? 0) + (sx < -0.6 || pad.buttons[14]?.pressed ? -1 : sx > 0.6 || pad.buttons[15]?.pressed ? 1 : 0);
    if (fire || s.stickAngle !== null) s.usingPad = true;
  }

  poll() {
    this.frame++;
    const pads = this.pads();
    const p1 = freshState();
    const p2 = freshState();
    this.pausePressed = this.keysPressed.has('Escape') || this.keysPressed.has('KeyP');

    // Player 1: mouse.
    // A click that went down and up between two frames still counts as a press.
    if (this.mouseDown || this.mousePressed) p1.fireDown = true;
    if (this.mousePressed) p1.pressedAny = p1.pressEvent = true;
    if (this.pointer && this.frame - this.pointerMovedAt < 600) p1.pointer = this.pointer;

    // Player 2: keyboard.
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) p2.aimDelta -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) p2.aimDelta += 1;
    const fireKeys = ['Space', 'Enter', 'ArrowUp', 'KeyW'];
    if (fireKeys.some((c) => k.has(c) || this.keysPressed.has(c))) p2.fireDown = true;
    for (const code of fireKeys) if (this.keysPressed.has(code)) p2.pressedAny = p2.pressEvent = true;
    p2.navRaw = (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('KeyA') ? -1 : 0)
      + (this.keysPressed.has('ArrowRight') || this.keysPressed.has('KeyD') ? 1 : 0);
    const p2KeyNav = p2.navRaw;

    // Gamepads.
    if (pads.length >= 2) {
      this.readPad(pads[0], p1);
      this.readPad(pads[1], p2);
    } else if (pads.length === 1) {
      this.readPad(pads[0], p2);
    }
    if (p1.usingPad) p1.pointer = null;

    [p1, p2].forEach((s, i) => {
      // A fresh press event always counts, even if the button never looked "up"
      // between two frames (fast tapping on a slow computer).
      s.firePressed = (s.fireDown && !this.prevFire[i]) || !!s.pressEvent;
      s.fireReleased = !s.fireDown && this.prevFire[i];
      this.prevFire[i] = s.fireDown;
      const nav = Math.sign(s.navRaw ?? 0);
      // Keyboard presses are already edges; sticks/d-pads need edge detection.
      s.navX = i === 1 && p2KeyNav ? p2KeyNav : nav !== this.prevNav[i] ? nav : 0;
      this.prevNav[i] = nav;
    });

    this.mouseClicked = this.mousePressed;
    this.keysPressed.clear();
    this.mousePressed = false;
    return [p1, p2];
  }
}
