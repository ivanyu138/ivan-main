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
      if (e.button === 0) this.hits.add('Mouse0');
      this.dragging = true;
    });
    addEventListener('mouseup', () => (this.dragging = false));
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el || this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
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
  }
}
