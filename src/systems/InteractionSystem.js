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

    // C1: Bin reference (set by main.js)
    this.props = null;

    this.promptEl = document.getElementById('interact-prompt');
  }

  setProps(props) {
    this.props = props;
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

    // C1: Also check bins for interaction
    let nearestBin = null;
    if (this.props) {
      for (const bin of this.props.getBins()) {
        if (bin.tipped) continue;
        const dist = distXZ(goosePos, bin);
        if (dist < bin.interactRadius && dist < nearestDist) {
          nearestBin = bin;
          nearestDist = dist;
          nearest = null; // Bin takes priority if closer
        }
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
    this.nearestBin = nearestBin;

    // Show/hide interact prompt
    const showPrompt = nearest !== null || this.carryingObject !== null || nearestBin !== null;
    this.promptEl.style.display = showPrompt ? 'block' : 'none';
    if (this.carryingObject) {
      this.promptEl.textContent = 'Press Space to drop';
    } else if (nearestBin) {
      this.promptEl.textContent = 'Press Space to knock over';
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

    // C1: Bin tipping
    if (this.nearestBin) {
      this.props.tipBin(this.nearestBin);
      this.audio.clatter();
      return { action: 'tipBin', bin: this.nearestBin };
    }

    if (!this.nearestObject) return null;

    const obj = this.nearestObject;

    // C2: Radio toggle - if dropped radio is nearby, toggle it
    if (obj instanceof CarriableObject && obj.name === 'radio' && !obj.isCarried) {
      if (obj.isPlaying) {
        obj.isPlaying = false;
        this.audio.stopRadio();
        return { action: 'radioOff' };
      }
      // Normal pickup for radio (not toggling)
    }

    // Carriable object - pick up
    if (obj instanceof CarriableObject) {
      // G3: Item-specific pickup sound
      this.audio.pickupItem(obj.name);
      obj.pickup(this.goose);
      this.carryingObject = obj;

      // C2: If radio was playing, stop when picked up
      if (obj.name === 'radio' && obj.isPlaying) {
        obj.isPlaying = false;
        this.audio.stopRadio();
      }

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

  // C2: Toggle radio on/off when dropped and Space pressed
  tryToggleRadio() {
    if (this.carryingObject) return false;
    const goosePos = this.goose.getPosition();
    const radio = this.registry.getByName('radio');
    if (!radio || radio.isCarried) return false;
    const dist = distXZ(goosePos, radio.getWorldPosition());
    if (dist > 1.5) return false;

    radio.isPlaying = !radio.isPlaying;
    if (radio.isPlaying) {
      this.audio.startRadio();
    } else {
      this.audio.stopRadio();
    }
    return true;
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
