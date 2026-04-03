export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.pointerButtons = new Set();
    this.justPressedPointerButtons = new Set();
    this.pointerPosition = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5
    };

    window.addEventListener('keydown', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.delete(event.code);
        this.justPressed.delete(event.code);
        return;
      }

      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
      }
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.delete(event.code);
        this.justPressed.delete(event.code);
        return;
      }

      this.keys.delete(event.code);
      this.justPressed.delete(event.code);
    });

    window.addEventListener('focusin', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.clear();
        this.justPressed.clear();
      }
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
      this.pointerButtons.clear();
      this.justPressedPointerButtons.clear();
    });

    window.addEventListener('pointermove', (event) => {
      this.pointerPosition.x = event.clientX;
      this.pointerPosition.y = event.clientY;
    });

    window.addEventListener('pointerdown', (event) => {
      if (this.isHudTarget(event.target)) {
        this.pointerButtons.delete(event.button);
        this.justPressedPointerButtons.delete(event.button);
        return;
      }

      if (!this.pointerButtons.has(event.button)) {
        this.justPressedPointerButtons.add(event.button);
      }
      this.pointerButtons.add(event.button);
    });

    window.addEventListener('pointerup', (event) => {
      this.pointerButtons.delete(event.button);
      this.justPressedPointerButtons.delete(event.button);
    });
  }

  isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.matches('input, textarea, select, [contenteditable="true"]');
  }

  isKeyboardSuspended() {
    return this.isEditableTarget(document.activeElement);
  }

  isHudTarget(target) {
    return target instanceof HTMLElement && Boolean(target.closest('.hud'));
  }

  getMovementVector() {
    if (this.isKeyboardSuspended()) {
      return { x: 0, z: 0 };
    }

    const x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const z = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    return { x, z };
  }

  consume(code) {
    if (this.isKeyboardSuspended()) {
      this.justPressed.delete(code);
      return false;
    }

    const pressed = this.justPressed.has(code);
    this.justPressed.delete(code);
    return pressed;
  }

  isPressed(code) {
    if (this.isKeyboardSuspended()) {
      return false;
    }

    return this.keys.has(code);
  }

  consumePointer(button = 0) {
    const pressed = this.justPressedPointerButtons.has(button);
    this.justPressedPointerButtons.delete(button);
    return pressed;
  }

  isPointerPressed(button = 0) {
    return this.pointerButtons.has(button);
  }

  getPointerPosition() {
    return { ...this.pointerPosition };
  }

  endFrame() {
    this.justPressed.clear();
    this.justPressedPointerButtons.clear();
  }
}
