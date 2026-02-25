import * as THREE from 'three';
import { InteractableObject } from './InteractableObject.js';

export class CarriableObject extends InteractableObject {
  constructor(mesh, name, interactRadius = 1.5) {
    super(mesh, name, interactRadius);
    this.isCarried = false;
    this.originalParent = mesh.parent;
    this.droppedPosition = mesh.position.clone();
    this.originalPosition = mesh.position.clone();
    this.originalScale = mesh.scale.clone();
  }

  pickup(goose) {
    if (this.isCarried) return false;
    this.isCarried = true;

    // Remove from scene, attach to goose beak
    const worldPos = this.getWorldPosition();
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // Scale down slightly when carried
    this.mesh.scale.set(0.7, 0.7, 0.7);
    this.mesh.rotation.set(0, 0, 0);

    goose.attachToBeak(this.mesh);
    return true;
  }

  drop(goose, scene, dropPosition) {
    if (!this.isCarried) return false;
    this.isCarried = false;

    const item = goose.detachFromBeak();
    if (item) {
      item.scale.copy(this.originalScale);
      scene.add(item);
      item.position.copy(dropPosition);
      item.position.y = this.originalPosition.y;
      this.droppedPosition = dropPosition.clone();
    }
    return true;
  }

  interact(gameState) {
    // Handled by InteractionSystem
  }
}
