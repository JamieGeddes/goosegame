import { InteractableObject } from './InteractableObject.js';

export class Gate extends InteractableObject {
  constructor(mesh, name, collisionManager, collisionName, options = {}) {
    super(mesh, name, 2.0);
    this.collisionManager = collisionManager;
    this.collisionName = collisionName;
    this.collisionBox = options.collisionBox || { dx1: -1.0, dz1: -0.1, dx2: 1.0, dz2: 0.1 };
    this.animating = false;

    if (options.startsOpen) {
      this.isOpen = true;
      this.targetRotation = -Math.PI / 2;
      this.currentRotation = -Math.PI / 2;
      mesh.rotation.y = -Math.PI / 2;
    } else {
      this.isOpen = false;
      this.targetRotation = 0;
      this.currentRotation = 0;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.targetRotation = this.isOpen ? -Math.PI / 2 : 0;
    this.animating = true;

    if (this.isOpen) {
      this.collisionManager.removeByName(this.collisionName);
    } else {
      // Re-add collision when closing
      const pos = this.getWorldPosition();
      this.collisionManager.addBox(
        pos.x + this.collisionBox.dx1, pos.z + this.collisionBox.dz1,
        pos.x + this.collisionBox.dx2, pos.z + this.collisionBox.dz2,
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
