const PREVENT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote']);

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.hits = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.hits.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.hits.add('Mouse0');
        this.keys.add('Mouse0');
      }
      this.dragging = true;
    });
    addEventListener('mouseup', (e) => {
      this.dragging = false;
      if (e.button === 0) this.keys.delete('Mouse0');
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el || this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Trackpad: a two-finger drag arrives as wheel events and turns the camera like the mouse;
    // a pinch arrives as a ctrl+wheel event and zooms.
    this.zoom = 0;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey) this.zoom += e.deltaY * k;
      else {
        // Inverted so the view follows the fingers, like dragging the scene.
        this.mouseDX -= e.deltaX * k * 1.5;
        this.mouseDY -= e.deltaY * k * 1.5;
      }
    }, { passive: false });
    // Safari's own pinch gesture events, so pinching zooms the camera instead of the page.
    for (const t of ['gesturestart', 'gesturechange']) el.addEventListener(t, (e) => e.preventDefault());
  }

  get locked() {
    return document.pointerLockElement === this.el;
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.hits.has(code);
  }

  digit() {
    for (let i = 1; i <= 9; i++) if (this.hits.has('Digit' + i) || this.hits.has('Numpad' + i)) return i;
    return 0;
  }

  endFrame() {
    this.hits.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.zoom = 0;
  }
}
