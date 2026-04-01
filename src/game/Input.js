export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.pointerPosition = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5
    };

    window.addEventListener('keydown', (event) => {
      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
      }
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.justPressed.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
    });

    window.addEventListener('pointermove', (event) => {
      this.pointerPosition.x = event.clientX;
      this.pointerPosition.y = event.clientY;
    });
  }

  getMovementVector() {
    const x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const z = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    return { x, z };
  }

  consume(code) {
    const pressed = this.justPressed.has(code);
    this.justPressed.delete(code);
    return pressed;
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  getPointerPosition() {
    return { ...this.pointerPosition };
  }

  endFrame() {
    this.justPressed.clear();
  }
}
