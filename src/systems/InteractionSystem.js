import * as THREE from 'three';
import { distXZ } from '../utils/MathHelpers.js';
import { CarriableObject } from '../objects/CarriableObject.js';

export class InteractionSystem {
  constructor(goose, objectRegistry, scene, audioManager) {
    this.goose = goose;
    this.registry = objectRegistry;
    this.scene = scene;
    this.audio = audioManager;
    this.nearestObject = null;
    this.carryingObject = null;

    this.promptEl = document.getElementById('interact-prompt');
  }

  update(dt) {
    const goosePos = this.goose.getPosition();
    let nearest = null;
    let nearestDist = Infinity;

    for (const obj of this.registry.getAll()) {
      if (!obj.isActive) continue;
      if (obj instanceof CarriableObject && obj.isCarried) continue;

      const objPos = obj.getWorldPosition();
      const dist = distXZ(goosePos, objPos);

      if (dist < obj.interactRadius && dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    // Update highlights
    if (this.nearestObject && this.nearestObject !== nearest) {
      this.nearestObject.setHighlight(false);
    }
    if (nearest) {
      nearest.setHighlight(true);
    }
    this.nearestObject = nearest;

    // Show/hide interact prompt
    const showPrompt = nearest !== null || this.carryingObject !== null;
    this.promptEl.style.display = showPrompt ? 'block' : 'none';
    if (this.carryingObject) {
      this.promptEl.textContent = 'Press Space to drop';
    } else if (nearest) {
      this.promptEl.textContent = 'Press Space';
    }
  }

  tryInteract() {
    // If carrying something, drop it
    if (this.carryingObject) {
      const dropPos = this.goose.getPosition().clone();
      const forward = new THREE.Vector3(
        Math.sin(this.goose.group.rotation.y),
        0,
        Math.cos(this.goose.group.rotation.y)
      );
      dropPos.add(forward.multiplyScalar(0.5));

      this.carryingObject.drop(this.goose, this.scene, dropPos);
      const droppedName = this.carryingObject.name;
      this.carryingObject = null;
      this.audio.pickup();
      return { action: 'drop', item: droppedName };
    }

    if (!this.nearestObject) return null;

    const obj = this.nearestObject;

    // Carriable object - pick up
    if (obj instanceof CarriableObject) {
      obj.pickup(this.goose);
      this.carryingObject = obj;
      this.audio.pickup();
      return { action: 'pickup', item: obj.name };
    }

    // Other interactable (gate, bell, etc.)
    const result = obj.interact({});
    if (result === 'bell') {
      this.audio.bell();
      return { action: 'bell' };
    }
    if (result === 'gate') {
      this.audio.gateCreak();
      return { action: 'gate', item: obj.name };
    }

    return { action: 'interact', item: obj.name };
  }

  isCarrying() {
    return this.carryingObject !== null;
  }

  getCarryingName() {
    return this.carryingObject ? this.carryingObject.name : null;
  }

  forceDropCarried() {
    if (!this.carryingObject) return;
    const dropPos = this.goose.getPosition().clone();
    this.carryingObject.drop(this.goose, this.scene, dropPos);
    this.carryingObject = null;
  }
}
