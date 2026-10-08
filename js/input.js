/**
 * Input: keyboard, mouse, touch (pointer events) and gamepad.
 *
 * Jump presses/releases are queued with their DOM timeStamp (same timebase as
 * performance.now()). The game consumes them per physics tick with sampleUntil(t), so the tick a
 * press lands on depends only on when it happened, not on the render rate.
 * Other actions (pause, restart, …) are dispatched to listeners immediately.
 */

export const DEFAULT_BINDINGS = {
  jump: ['Space', 'ArrowUp', 'KeyW'],
  pause: ['Escape'],
  restart: ['KeyR'],
  practice: ['KeyP'],
  checkpoint: ['KeyZ'],
  uncheckpoint: ['KeyX'],
  hitboxes: ['KeyH'],
  fps: ['KeyF'],
  mute: ['KeyM'],
  fullscreen: ['F11'],
};

export const ACTION_LABELS = {
  jump: 'Jump', pause: 'Pause', restart: 'Restart', practice: 'Practice mode', checkpoint: 'Place checkpoint',
  uncheckpoint: 'Remove checkpoint', hitboxes: 'Show hitboxes', fps: 'Show FPS', mute: 'Mute', fullscreen: 'Fullscreen',
};

/**
 * Timestamped jump-button timeline (DOM-free). Sources (a key, a pointer, a pad button) can be
 * held simultaneously; the button counts as held while any source is down and every new source
 * going down is a press.
 */
export class JumpQueue {
  constructor() {
    this.queue = [];
    this.sources = new Set();
    this.heldState = false;
    this.gameplay = false;
  }

  press(source, t) {
    if (this.sources.has(source)) return;
    this.sources.add(source);
    if (!this.gameplay) return;
    this.queue.push({ t, down: true, held: true });
  }

  release(source, t) {
    if (!this.sources.delete(source)) return;
    if (!this.gameplay) return;
    this.queue.push({ t, down: false, held: this.sources.size > 0 });
  }

  /** Is any jump source currently held (for UI hold indicators). */
  get held() { return this.sources.size > 0; }

  /**
   * Consumes queued events with timestamp ≤ t into `out` = { held, pressed } for one tick.
   */
  sampleUntil(t, out) {
    let pressed = false;
    let i = 0;
    const q = this.queue;
    while (i < q.length && q[i].t <= t) {
      const e = q[i++];
      if (e.down) pressed = true;
      this.heldState = e.held;
    }
    if (i) q.splice(0, i);
    out.held = this.heldState;
    out.pressed = pressed;
    return out;
  }

  /** Starts/stops routing jump input to the game; clears stale state either way. */
  setGameplay(on) {
    this.gameplay = on;
    this.queue.length = 0;
    this.heldState = on && this.sources.size > 0;
  }

  /** Drops queued events (e.g. on restart) but keeps the held state. */
  flush() { this.queue.length = 0; this.heldState = this.sources.size > 0; }
}

export class Input extends JumpQueue {
  constructor(surface) {
    super();
    this.surface = surface;
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.listeners = new Map();
    this.pads = new Map();
    this.capture = null;
    this.lastPadPoll = 0;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setBindings(b) { this.bindings = { ...structuredClone(DEFAULT_BINDINGS), ...(b || {}) }; }

  on(action, fn) {
    if (!this.listeners.has(action)) this.listeners.set(action, new Set());
    this.listeners.get(action).add(fn);
    return () => this.listeners.get(action).delete(fn);
  }

  emit(action, e) {
    const set = this.listeners.get(action);
    if (!set) return false;
    for (const fn of [...set]) fn(e);
    return set.size > 0;
  }

  actionFor(code) {
    for (const [a, codes] of Object.entries(this.bindings)) if (codes.includes(code)) return a;
    return null;
  }

  /** While a key-capture callback is set (rebinding UI), the next key goes there. */
  captureNextKey(fn) { this.capture = fn; }

  // ---- DOM handlers ------------------------------------------------------------------------
  onKeyDown(e) {
    if (this.capture) {
      e.preventDefault();
      const fn = this.capture;
      this.capture = null;
      fn(e.code);
      return;
    }
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    if (typing) return;
    const action = this.actionFor(e.code);
    if (action === 'jump' && this.gameplay) {
      e.preventDefault();
      if (!e.repeat) this.press(`k:${e.code}`, e.timeStamp);
      return;
    }
    if (e.repeat) return;
    if (action && action !== 'jump') {
      if (this.emit(action, e)) e.preventDefault();
      return;
    }
    this.emit('key', e);
  }

  onKeyUp(e) {
    this.release(`k:${e.code}`, e.timeStamp);
  }

  onPointerDown(e) {
    if (!this.gameplay) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Taps on on-screen controls (pause, checkpoints) are not jumps.
    if (e.target.closest && e.target.closest('button, input, select, textarea, label, a, .no-jump')) return;
    e.preventDefault();
    this.press(`p:${e.pointerId}`, e.timeStamp);
  }

  onPointerUp(e) {
    this.release(`p:${e.pointerId}`, e.timeStamp);
  }

  onBlur() {
    const t = performance.now();
    for (const s of [...this.sources]) this.release(s, t);
  }

  // ---- gamepad -----------------------------------------------------------------------------
  /**
   * Polls gamepads (call once per frame). Face buttons and RT jump, Start pauses, D-pad / left
   * stick emit 'nav' events for menus with repeat.
   */
  pollGamepads(now) {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp) continue;
      let st = this.pads.get(gp.index);
      if (!st) { st = { buttons: [], nav: null, navT: 0 }; this.pads.set(gp.index, st); }
      for (let b = 0; b < gp.buttons.length; b++) {
        const down = gp.buttons[b].pressed || gp.buttons[b].value > 0.5;
        const was = !!st.buttons[b];
        if (down === was) continue;
        st.buttons[b] = down;
        const jumpBtn = b <= 3 || b === 7 || b === 6;
        if (jumpBtn) {
          if (down) this.press(`g:${gp.index}:${b}`, now); else this.release(`g:${gp.index}:${b}`, now);
          if (down && !this.gameplay) this.emit(b === 1 ? 'back' : 'confirm', null);
        }
        if (b === 9 && down) this.emit('pause', null);
        if (b === 8 && down) this.emit('back', null);
      }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (st.buttons[12] || ay < -0.6) dir = 'up';
      else if (st.buttons[13] || ay > 0.6) dir = 'down';
      else if (st.buttons[14] || ax < -0.6) dir = 'left';
      else if (st.buttons[15] || ax > 0.6) dir = 'right';
      if (dir !== st.nav) { st.nav = dir; st.navT = now + 380; if (dir) this.emit('nav', dir); }
      else if (dir && now > st.navT) { st.navT = now + 130; this.emit('nav', dir); }
    }
  }
}
