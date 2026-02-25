import { InteractableObject } from './InteractableObject.js';

export class Gate extends InteractableObject {
  constructor(mesh, name, collisionManager, collisionName) {
    super(mesh, name, 2.0);
    this.isOpen = false;
    this.targetRotation = 0;
    this.currentRotation = 0;
    this.collisionManager = collisionManager;
    this.collisionName = collisionName;
    this.animating = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.targetRotation = this.isOpen ? -Math.PI / 2 : 0;
    this.animating = true;

    if (this.isOpen) {
      this.collisionManager.removeByName(this.collisionName);
    } else {
      // Re-add collision when closing - approximate position
      const pos = this.getWorldPosition();
      this.collisionManager.addBox(
        pos.x - 0.6, pos.z - 0.1,
        pos.x + 0.6, pos.z + 0.1,
        this.collisionName
      );
    }
  }

  interact(gameState) {
    this.toggle();
    return 'gate';
  }

  update(dt) {
    if (!this.animating) return;
    const speed = 3;
    const diff = this.targetRotation - this.currentRotation;
    if (Math.abs(diff) < 0.01) {
      this.currentRotation = this.targetRotation;
      this.animating = false;
    } else {
      this.currentRotation += Math.sign(diff) * speed * dt;
    }
    this.mesh.rotation.y = this.currentRotation;
  }
}
