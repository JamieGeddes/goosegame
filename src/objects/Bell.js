import { InteractableObject } from './InteractableObject.js';

export class Bell extends InteractableObject {
  constructor(mesh, name) {
    super(mesh, name, 2.0);
    this.ringing = false;
    this.ringTimer = 0;
    this.hasBeenRung = false;
  }

  ring() {
    this.ringing = true;
    this.ringTimer = 0;
    this.hasBeenRung = true;
  }

  interact(gameState) {
    this.ring();
    return 'bell';
  }

  update(dt) {
    if (!this.ringing) return;
    this.ringTimer += dt;
    const t = this.ringTimer;
    if (t < 1.0) {
      this.mesh.rotation.z = Math.sin(t * 20) * 0.3 * (1 - t);
    } else {
      this.mesh.rotation.z = 0;
      this.ringing = false;
    }
  }
}
