export class HonkIndicator {
  constructor() {
    this.element = document.getElementById('honk-indicator');
    this.timer = 0;
    this.showing = false;
  }

  show() {
    this.element.style.display = 'block';
    this.element.style.opacity = '1';
    this.showing = true;
    this.timer = 0;
  }

  update(dt) {
    if (!this.showing) return;
    this.timer += dt;
    if (this.timer > 0.4) {
      const fade = 1 - (this.timer - 0.4) / 0.3;
      this.element.style.opacity = String(Math.max(0, fade));
      if (fade <= 0) {
        this.showing = false;
        this.element.style.display = 'none';
      }
    }
  }
}
