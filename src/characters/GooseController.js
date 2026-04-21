import * as THREE from 'three';
import { angleLerp } from '../utils/MathHelpers.js';

export class GooseController {
  constructor(goose, input, camera, collisionManager) {
    this.goose = goose;
    this.input = input;
    this.camera = camera;
    this.collision = collisionManager;

    this.walkSpeed = 3.5;
    this.runSpeed = 6;
    this.crouchSpeed = 1.75; // D2: Half walk speed
    this.turnSpeed = 8;
    this.targetAngle = 0;
    this.currentAngle = 0;

    this.footstepTimer = 0;
    this.footstepInterval = 0.35;
  }

  update(dt) {
    const move = this.input.getMovement();
    const isMoving = Math.abs(move.x) > 0.01 || Math.abs(move.z) > 0.01;
    const isRunning = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');

    // D2: Crouch mode (Ctrl or C key) - incompatible with carrying
    const wantsCrouch = this.input.isDown('ControlLeft') || this.input.isDown('ControlRight') || this.input.isDown('KeyC');
    const isCrouching = wantsCrouch && !this.goose.carryingItem;
    this.goose.setCrouch(isCrouching);

    // Speed depends on crouch/run state
    let speed;
    if (isCrouching) {
      speed = this.crouchSpeed;
    } else if (isRunning) {
      speed = this.runSpeed;
    } else {
      speed = this.walkSpeed;
    }

    this.goose.isWalking = isMoving;
    this.goose.isRunning = isRunning && isMoving && !isCrouching;

    if (isMoving) {
      // Camera-relative movement
      const camForward = this.camera.getForward();
      const camRight = this.camera.getRight();

      const dirX = camForward.x * move.z + camRight.x * move.x;
      const dirZ = camForward.z * move.z + camRight.z * move.x;

      this.targetAngle = Math.atan2(dirX, dirZ);
      this.currentAngle = angleLerp(this.currentAngle, this.targetAngle, dt * this.turnSpeed);

      const oldPos = this.goose.group.position.clone();
      const newX = oldPos.x + Math.sin(this.currentAngle) * speed * dt;
      const newZ = oldPos.z + Math.cos(this.currentAngle) * speed * dt;

      // Collision resolution
      const resolved = this.collision.resolve(
        { x: oldPos.x, z: oldPos.z },
        { x: newX, z: newZ },
        0.3
      );

      // World bounds
      const bound = 35;
      this.goose.group.position.x = Math.max(-bound, Math.min(bound, resolved.x));
      this.goose.group.position.z = Math.max(-bound, Math.min(bound, resolved.z));
      this.goose.group.rotation.y = this.currentAngle;

      // Footstep timing (no footsteps when crouching - D2)
      if (!isCrouching) {
        this.footstepTimer += dt;
        const interval = isRunning ? 0.22 : this.footstepInterval;
        if (this.footstepTimer >= interval) {
          this.footstepTimer = 0;
          return 'footstep';
        }
      }
    } else {
      this.footstepTimer = 0;
    }

    return null;
  }
}
