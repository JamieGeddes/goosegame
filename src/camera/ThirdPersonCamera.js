import * as THREE from 'three';
import { lerp, clamp } from '../utils/MathHelpers.js';

export class ThirdPersonCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.target = null;

    this.offset = new THREE.Vector3(0, 4, -6);
    this.currentOffset = this.offset.clone();
    this.yaw = 0;
    this.pitch = 0.3;
    this.distance = 6;
    this.smoothSpeed = 5;
    this.rotateSpeed = 0.003;

    this.raycaster = new THREE.Raycaster();
    this.collisionObjects = [];
  }

  setTarget(obj) {
    this.target = obj;
  }

  setCollisionObjects(objects) {
    this.collisionObjects = objects;
  }

  getForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  getRight() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt) {
    if (!this.target) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    this.yaw += dx * this.rotateSpeed;
    this.pitch = clamp(this.pitch - dy * this.rotateSpeed, -0.2, 1.2);

    const targetPos = new THREE.Vector3();
    this.target.getWorldPosition(targetPos);
    targetPos.y += 1.2;

    const camX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const camY = Math.sin(this.pitch) * this.distance;
    const camZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    const desiredPos = new THREE.Vector3(
      targetPos.x + camX,
      targetPos.y + camY,
      targetPos.z + camZ
    );

    // Anti-clip: raycast from target to desired position
    if (this.collisionObjects.length > 0) {
      const dir = desiredPos.clone().sub(targetPos).normalize();
      this.raycaster.set(targetPos, dir);
      this.raycaster.far = this.distance;
      const hits = this.raycaster.intersectObjects(this.collisionObjects, true);
      if (hits.length > 0 && hits[0].distance < this.distance) {
        const safeDistance = hits[0].distance - 0.3;
        if (safeDistance > 1) {
          desiredPos.copy(targetPos).add(dir.multiplyScalar(safeDistance));
        }
      }
    }

    const t = 1 - Math.exp(-this.smoothSpeed * dt);
    this.camera.position.lerp(desiredPos, t);
    this.camera.lookAt(targetPos);
  }
}
