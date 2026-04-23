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

    // Screen shake (G2)
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
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

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  update(dt) {
    if (!this.target) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    this.yaw += dx * this.rotateSpeed;
    this.pitch = clamp(this.pitch - dy * this.rotateSpeed, 0.1, 1.2);

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

    // Hard floor: never let camera go below ground
    desiredPos.y = Math.max(desiredPos.y, 1.0);

    // Pass 1: clip the lerp target so smoothing settles in the safe zone.
    // Without this, the lerp each frame pulls the camera outward toward an
    // outside-wall desiredPos and the pass-2 snap drags it back, producing
    // continuous per-frame radial "breathing" (heavy flicker).
    if (this.collisionObjects.length > 0) {
      const dir = desiredPos.clone().sub(targetPos);
      const dist = dir.length();
      if (dist > 0.01) {
        dir.divideScalar(dist);
        this.raycaster.set(targetPos, dir);
        this.raycaster.far = dist;
        const hits = this.raycaster.intersectObjects(this.collisionObjects, true);
        if (hits.length > 0) {
          const safeDistance = Math.max(hits[0].distance - 0.3, 0.4);
          desiredPos.copy(targetPos).add(dir.multiplyScalar(safeDistance));
        }
      }
    }

    const t = 1 - Math.exp(-this.smoothSpeed * dt);
    this.camera.position.lerp(desiredPos, t);

    // Pass 2: if the lerp still has the camera past a wall (e.g. goose just
    // ran up to one and smoothing hasn't caught up), hard-snap it in along
    // the current target→camera direction. Only fires during transients.
    if (this.collisionObjects.length > 0) {
      const dir = this.camera.position.clone().sub(targetPos);
      const dist = dir.length();
      if (dist > 0.01) {
        dir.divideScalar(dist);
        this.raycaster.set(targetPos, dir);
        this.raycaster.far = dist;
        const hits = this.raycaster.intersectObjects(this.collisionObjects, true);
        if (hits.length > 0) {
          const safeDistance = Math.max(hits[0].distance - 0.3, 0.4);
          this.camera.position.copy(targetPos).add(dir.multiplyScalar(safeDistance));
        }
      }
    }

    this.camera.lookAt(targetPos);

    // Apply screen shake
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const progress = this.shakeTimer / this.shakeDuration;
      const damping = 1 - progress;
      const freq = 25;
      const offsetX = Math.sin(this.shakeTimer * freq) * this.shakeIntensity * damping;
      const offsetY = Math.sin(this.shakeTimer * freq * 1.3 + 1.5) * this.shakeIntensity * damping * 0.7;
      this.camera.position.x += offsetX;
      this.camera.position.y += offsetY;
    }
  }
}
