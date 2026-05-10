const ACTION_KEY_CODES = Object.freeze({
  chat: ['Enter'],
  emote: ['KeyB'],
  escape: ['Escape'],
  interact: ['KeyE'],
  phone: ['Tab'],
  reload: ['KeyR'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract']
});

const ACTION_POINTER_BUTTONS = Object.freeze({
  aim: 2,
  fire: 0
});

const MOBILE_STICK_DEADZONE = 0.12;
const TOUCH_MOUSE_SUPPRESSION_MS = 700;

function clampStickVector(dx, dy, radius) {
  const safeRadius = Math.max(1, Number(radius) || 1);
  const distance = Math.hypot(dx, dy);
  if (distance <= safeRadius) {
    return { x: dx, y: dy };
  }

  const scale = safeRadius / distance;
  return {
    x: dx * scale,
    y: dy * scale
  };
}

function applyDeadzone(value) {
  return Math.abs(value) < MOBILE_STICK_DEADZONE ? 0 : value;
}

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.keyPressQueue = [];
    this.pointerButtons = new Set();
    this.justPressedPointerButtons = new Set();
    this.wheelDirection = 0;
    this.touchControlsEnabled = true;
    this.touchActionPointers = new Map();
    this.justPressedActions = new Set();
    this.touchMovementVector = { x: 0, z: 0 };
    this.touchAimVector = { x: 0, z: 0 };
    this.touchAimActive = false;
    this.mobileControlsRoot = null;
    this.mobileJoystick = null;
    this.mobileJoystickKnob = null;
    this.mobileAimPad = null;
    this.mobileAimKnob = null;
    this.mobileJoystickPointerId = null;
    this.mobileAimPointerId = null;
    this.mobileActionPointerActions = new Map();
    this.mobileActionPointerButtons = new Map();
    this.actionPressCallbacks = new Map();
    this.lastTouchPointerAt = -Infinity;
    this.pointerPosition = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5
    };
    this.onPointerButtonDown = (event) => {
      if (event.pointerType === 'touch') {
        this.lastTouchPointerAt = performance.now();
        return;
      }

      if (
        event.type === 'mousedown'
        && performance.now() - this.lastTouchPointerAt < TOUCH_MOUSE_SUPPRESSION_MS
      ) {
        return;
      }

      if (this.isHudTarget(event.target)) {
        this.pointerButtons.delete(event.button);
        this.justPressedPointerButtons.delete(event.button);
        return;
      }

      if (!this.pointerButtons.has(event.button)) {
        this.justPressedPointerButtons.add(event.button);
      }
      this.pointerButtons.add(event.button);
    };
    this.onPointerButtonUp = (event) => {
      this.pointerButtons.delete(event.button);
      this.justPressedPointerButtons.delete(event.button);
    };

    window.addEventListener('keydown', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.delete(event.code);
        this.justPressed.delete(event.code);
        this.keyPressQueue = [];
        return;
      }

      if (event.code === 'Tab') {
        event.preventDefault();
      }

      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
        this.keyPressQueue.push({ code: event.code, at: performance.now() });
        if (this.keyPressQueue.length > 64) {
          this.keyPressQueue.shift();
        }
      }
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.delete(event.code);
        this.justPressed.delete(event.code);
        this.keyPressQueue = [];
        return;
      }

      this.keys.delete(event.code);
      this.justPressed.delete(event.code);
    });

    window.addEventListener('focusin', (event) => {
      if (this.isEditableTarget(event.target)) {
        this.keys.clear();
        this.justPressed.clear();
        this.keyPressQueue = [];
      }
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
      this.keyPressQueue = [];
      this.pointerButtons.clear();
      this.justPressedPointerButtons.clear();
      this.releaseAllTouchControls();
    });

    window.addEventListener('pointermove', (event) => {
      this.pointerPosition.x = event.clientX;
      this.pointerPosition.y = event.clientY;
    });
    window.addEventListener('wheel', (event) => {
      if (this.isHudTarget(event.target)) {
        return;
      }

      const direction = Math.sign(event.deltaY);
      if (direction !== 0) {
        this.wheelDirection += direction;
      }
    }, { passive: true });

    window.addEventListener('pointerdown', this.onPointerButtonDown);
    window.addEventListener('pointerup', this.onPointerButtonUp);
    window.addEventListener('mousedown', this.onPointerButtonDown);
    window.addEventListener('mouseup', this.onPointerButtonUp);
  }

  bindActionPress(action, callback) {
    if (!action || typeof callback !== 'function') {
      return () => {};
    }

    const callbacks = this.actionPressCallbacks.get(action) ?? new Set();
    callbacks.add(callback);
    this.actionPressCallbacks.set(action, callbacks);
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.actionPressCallbacks.delete(action);
      }
    };
  }

  emitActionPress(action) {
    const callbacks = this.actionPressCallbacks.get(action);
    if (!callbacks?.size) {
      return;
    }

    for (const callback of callbacks) {
      callback(action);
    }
  }

  attachMobileControls(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }

    this.mobileControlsRoot = root;
    this.mobileJoystick = root.querySelector('[data-mobile-joystick]');
    this.mobileJoystickKnob = root.querySelector('[data-mobile-joystick-knob]');
    this.mobileAimPad = root.querySelector('[data-mobile-aim]');
    this.mobileAimKnob = root.querySelector('[data-mobile-aim-knob]');

    this.mobileJoystick?.addEventListener('pointerdown', (event) => this.onMobileJoystickDown(event));
    this.mobileJoystick?.addEventListener('pointermove', (event) => this.onMobileJoystickMove(event));
    this.mobileJoystick?.addEventListener('pointerup', (event) => this.onMobileJoystickUp(event));
    this.mobileJoystick?.addEventListener('pointercancel', (event) => this.onMobileJoystickUp(event));
    this.mobileJoystick?.addEventListener('lostpointercapture', (event) => this.onMobileJoystickUp(event));

    this.mobileAimPad?.addEventListener('pointerdown', (event) => this.onMobileAimDown(event));
    this.mobileAimPad?.addEventListener('pointermove', (event) => this.onMobileAimMove(event));
    this.mobileAimPad?.addEventListener('pointerup', (event) => this.onMobileAimUp(event));
    this.mobileAimPad?.addEventListener('pointercancel', (event) => this.onMobileAimUp(event));
    this.mobileAimPad?.addEventListener('lostpointercapture', (event) => this.onMobileAimUp(event));

    for (const button of root.querySelectorAll('[data-mobile-action]')) {
      button.addEventListener('pointerdown', (event) => this.onMobileActionDown(event));
      button.addEventListener('pointermove', (event) => this.onMobileActionMove(event));
      button.addEventListener('pointerup', (event) => this.onMobileActionUp(event));
      button.addEventListener('pointercancel', (event) => this.onMobileActionUp(event));
      button.addEventListener('lostpointercapture', (event) => this.onMobileActionUp(event));
    }
  }

  setTouchControlsEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === this.touchControlsEnabled) {
      return;
    }

    this.touchControlsEnabled = nextEnabled;
    if (!this.touchControlsEnabled) {
      this.releaseAllTouchControls();
    }
  }

  onMobileJoystickDown(event) {
    if (!this.touchControlsEnabled || this.mobileJoystickPointerId !== null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.lastTouchPointerAt = performance.now();
    this.mobileJoystickPointerId = event.pointerId;
    this.mobileJoystick?.setPointerCapture?.(event.pointerId);
    this.mobileJoystick?.classList.add('is-active');
    this.updateMobileJoystick(event);
  }

  onMobileJoystickMove(event) {
    if (event.pointerId !== this.mobileJoystickPointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.updateMobileJoystick(event);
  }

  onMobileJoystickUp(event) {
    if (event.pointerId !== this.mobileJoystickPointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.mobileJoystickPointerId = null;
    this.touchMovementVector = { x: 0, z: 0 };
    this.mobileJoystick?.classList.remove('is-active');
    this.syncMobileControlStyles();
  }

  onMobileAimDown(event) {
    if (!this.touchControlsEnabled || this.mobileAimPointerId !== null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.lastTouchPointerAt = performance.now();
    this.mobileAimPointerId = event.pointerId;
    this.mobileAimPad?.setPointerCapture?.(event.pointerId);
    this.mobileAimPad?.classList.add('is-active');
    this.startTouchAction('aim', event.pointerId);
    this.updateMobileAim(event);
  }

  onMobileAimMove(event) {
    if (event.pointerId !== this.mobileAimPointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.updateMobileAim(event);
  }

  onMobileAimUp(event) {
    if (event.pointerId !== this.mobileAimPointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.endTouchAction('aim', event.pointerId);
    this.mobileAimPointerId = null;
    this.touchAimActive = false;
    this.touchAimVector = { x: 0, z: 0 };
    this.mobileAimPad?.classList.remove('is-active');
    this.syncMobileControlStyles();
  }

  onMobileActionDown(event) {
    const button = event.currentTarget;
    const action = button?.dataset?.mobileAction;
    if (!this.touchControlsEnabled || !action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.lastTouchPointerAt = performance.now();
    this.mobileActionPointerActions.set(event.pointerId, action);
    this.mobileActionPointerButtons.set(event.pointerId, button);
    button.classList.add('is-active');
    button.setPointerCapture?.(event.pointerId);
    if (action === 'emote') {
      this.pointerPosition.x = window.innerWidth * 0.5;
      this.pointerPosition.y = window.innerHeight * 0.5;
    }
    this.startTouchAction(action, event.pointerId);
  }

  onMobileActionMove(event) {
    const action = this.mobileActionPointerActions.get(event.pointerId);
    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (action === 'emote') {
      this.pointerPosition.x = event.clientX;
      this.pointerPosition.y = event.clientY;
    }
  }

  onMobileActionUp(event) {
    const action = this.mobileActionPointerActions.get(event.pointerId);
    const button = this.mobileActionPointerButtons.get(event.pointerId);
    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.endTouchAction(action, event.pointerId);
    button?.classList.remove('is-active');
    this.mobileActionPointerActions.delete(event.pointerId);
    this.mobileActionPointerButtons.delete(event.pointerId);
  }

  updateMobileJoystick(event) {
    const vector = this.getMobileControlVector(this.mobileJoystick, event);
    this.touchMovementVector = {
      x: applyDeadzone(vector.normalizedX),
      z: applyDeadzone(vector.normalizedY)
    };
    this.syncMobileControlStyles();
  }

  updateMobileAim(event) {
    const vector = this.getMobileControlVector(this.mobileAimPad, event);
    this.touchAimActive = true;
    this.touchAimVector = {
      x: applyDeadzone(vector.normalizedX),
      z: applyDeadzone(vector.normalizedY)
    };
    this.pointerPosition.x = event.clientX;
    this.pointerPosition.y = event.clientY;
    this.syncMobileControlStyles();
  }

  getMobileControlVector(element, event) {
    const bounds = element?.getBoundingClientRect?.();
    if (!bounds?.width || !bounds?.height) {
      return {
        knobX: 0,
        knobY: 0,
        normalizedX: 0,
        normalizedY: 0
      };
    }

    const radius = Math.min(bounds.width, bounds.height) * 0.34;
    const centerX = bounds.left + bounds.width * 0.5;
    const centerY = bounds.top + bounds.height * 0.5;
    const clamped = clampStickVector(event.clientX - centerX, event.clientY - centerY, radius);
    return {
      knobX: clamped.x,
      knobY: clamped.y,
      normalizedX: clamped.x / radius,
      normalizedY: clamped.y / radius
    };
  }

  syncMobileControlStyles() {
    const joystickX = this.touchMovementVector.x * 34;
    const joystickY = this.touchMovementVector.z * 34;
    this.mobileJoystickKnob?.style.setProperty('--stick-x', `${joystickX.toFixed(1)}px`);
    this.mobileJoystickKnob?.style.setProperty('--stick-y', `${joystickY.toFixed(1)}px`);

    const aimX = this.touchAimVector.x * 28;
    const aimY = this.touchAimVector.z * 28;
    this.mobileAimKnob?.style.setProperty('--stick-x', `${aimX.toFixed(1)}px`);
    this.mobileAimKnob?.style.setProperty('--stick-y', `${aimY.toFixed(1)}px`);
  }

  startTouchAction(action, pointerId) {
    if (!this.touchControlsEnabled) {
      return;
    }

    const pointers = this.touchActionPointers.get(action) ?? new Set();
    const wasPressed = pointers.size > 0;
    pointers.add(pointerId);
    this.touchActionPointers.set(action, pointers);

    if (!wasPressed) {
      this.justPressedActions.add(action);
      this.emitActionPress(action);
    }
  }

  endTouchAction(action, pointerId) {
    const pointers = this.touchActionPointers.get(action);
    if (!pointers) {
      return;
    }

    pointers.delete(pointerId);
    if (pointers.size === 0) {
      this.touchActionPointers.delete(action);
    }
  }

  releaseAllTouchControls() {
    this.touchActionPointers.clear();
    this.justPressedActions.clear();
    this.touchMovementVector = { x: 0, z: 0 };
    this.touchAimVector = { x: 0, z: 0 };
    this.touchAimActive = false;
    this.mobileJoystickPointerId = null;
    this.mobileAimPointerId = null;
    this.mobileActionPointerActions.clear();
    this.mobileActionPointerButtons.clear();
    this.mobileJoystick?.classList.remove('is-active');
    this.mobileAimPad?.classList.remove('is-active');
    for (const button of this.mobileControlsRoot?.querySelectorAll('[data-mobile-action].is-active') ?? []) {
      button.classList.remove('is-active');
    }
    this.syncMobileControlStyles();
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
    let x = 0;
    let z = 0;

    if (!this.isKeyboardSuspended()) {
      x += (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
      z += (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    }

    if (this.touchControlsEnabled) {
      x += this.touchMovementVector.x;
      z += this.touchMovementVector.z;
    }

    const length = Math.hypot(x, z);
    if (length > 1) {
      return {
        x: x / length,
        z: z / length
      };
    }

    return { x, z };
  }

  consumeAction(action) {
    if (this.justPressedActions.has(action)) {
      this.justPressedActions.delete(action);
      return true;
    }

    for (const code of ACTION_KEY_CODES[action] ?? []) {
      if (this.consume(code)) {
        return true;
      }
    }

    const pointerButton = ACTION_POINTER_BUTTONS[action];
    if (Number.isInteger(pointerButton)) {
      return this.consumePointer(pointerButton);
    }

    return false;
  }

  isActionPressed(action) {
    if (this.touchActionPointers.has(action)) {
      return true;
    }

    for (const code of ACTION_KEY_CODES[action] ?? []) {
      if (this.isPressed(code)) {
        return true;
      }
    }

    const pointerButton = ACTION_POINTER_BUTTONS[action];
    return Number.isInteger(pointerButton) ? this.isPointerPressed(pointerButton) : false;
  }

  getAimVector() {
    if (!this.touchControlsEnabled || !this.touchAimActive) {
      return null;
    }

    const { x, z } = this.touchAimVector;
    if (Math.hypot(x, z) < MOBILE_STICK_DEADZONE) {
      return null;
    }

    return { x, z };
  }

  consume(code) {
    if (this.isKeyboardSuspended()) {
      this.justPressed.delete(code);
      return false;
    }

    const pressed = this.justPressed.has(code);
    this.justPressed.delete(code);
    if (pressed) {
      const queueIndex = this.keyPressQueue.findIndex((entry) => entry.code === code);
      if (queueIndex >= 0) {
        this.keyPressQueue.splice(queueIndex, 1);
      }
    }
    return pressed;
  }

  consumeNextKey(codes = []) {
    return this.consumeNextKeyEvent(codes)?.code ?? '';
  }

  consumeNextKeyEvent(codes = []) {
    if (this.isKeyboardSuspended()) {
      this.keyPressQueue = [];
      return null;
    }

    const allowed = new Set(codes);
    const queueIndex = this.keyPressQueue.findIndex((entry) => allowed.has(entry.code));
    if (queueIndex < 0) {
      return null;
    }

    const [entry] = this.keyPressQueue.splice(queueIndex, 1);
    this.justPressed.delete(entry.code);
    return entry;
  }

  clearKeyPressQueue() {
    this.keyPressQueue = [];
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

  consumeWheelDirection() {
    const direction = Math.sign(this.wheelDirection);
    this.wheelDirection = 0;
    return direction;
  }

  getPointerPosition() {
    return { ...this.pointerPosition };
  }

  endFrame() {
    this.justPressed.clear();
    this.justPressedPointerButtons.clear();
    this.justPressedActions.clear();
    this.wheelDirection = 0;
  }
}
