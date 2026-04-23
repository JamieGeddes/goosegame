import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';
import { InteractableObject } from './InteractableObject.js';

// Wall-mounted fire alarm lever. Space-to-pull, one-shot.
// Builds its own mesh: red box with a white lever.
export function createFireAlarmMesh(x, y, z, facing = 0) {
  const g = new THREE.Group();
  g.name = 'fireAlarm';

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.4, 0.12),
    Mat.alarmRed,
  );
  box.position.y = 0;
  g.add(box);

  const labelPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.1, 0.02),
    Mat.alarmWhite,
  );
  labelPlate.position.set(0, 0.1, 0.07);
  g.add(labelPlate);

  // White pull-down lever
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.05),
    Mat.alarmWhite,
  );
  lever.position.set(0, -0.08, 0.08);
  g.add(lever);
  g.userData.lever = lever;

  g.position.set(x, y, z);
  g.rotation.y = facing;
  return g;
}

export class FireAlarm extends InteractableObject {
  constructor(mesh) {
    super(mesh, 'fireAlarm', 1.5);
    // `pulled` is a one-way latch for task completion — stays true once tripped.
    // `sounding` tracks whether the klaxon is currently on; can be silenced by
    // interacting again.
    this.pulled = false;
    this.sounding = false;
    this.lever = mesh.userData.lever;
  }

  interact() {
    if (!this.pulled) {
      this.pulled = true;
      this.sounding = true;
      if (this.lever) {
        this.lever.position.y = -0.16;
        this.lever.rotation.x = 0.4;
      }
      return 'fireAlarmPull';
    }
    // Already pulled — toggle the sounding state so the player can silence it.
    this.sounding = !this.sounding;
    if (this.lever) {
      if (this.sounding) {
        this.lever.position.y = -0.16;
        this.lever.rotation.x = 0.4;
      } else {
        this.lever.position.y = -0.08;
        this.lever.rotation.x = 0;
      }
    }
    return this.sounding ? 'fireAlarmPull' : 'fireAlarmReset';
  }
}
