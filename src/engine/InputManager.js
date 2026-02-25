export class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.keysJustPressed = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0 };
    this.isPointerLocked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.keysJustPressed[e.code] = true;
      }
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    });
  }

  isDown(code) {
    return !!this.keys[code];
  }

  justPressed(code) {
    return !!this.keysJustPressed[code];
  }

  getMovement() {
    let x = 0, z = 0;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) z += 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) z -= 1;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
    const len = Math.sqrt(x * x + z * z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z };
  }

  consumeMouseDelta() {
    const dx = this.mouse.dx;
    const dy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }

  endFrame() {
    this.keysJustPressed = {};
  }
}
