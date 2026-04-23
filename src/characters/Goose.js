import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';
import { createWebbedFoot, createEggShape } from '../utils/GeometryHelpers.js';

export class Goose {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'goose';

    // Animation state
    this.walkPhase = 0;
    this.isWalking = false;
    this.isRunning = false;
    this.isHonking = false;
    this.honkTimer = 0;
    this.idleTimer = 0;
    this.idleLookAngle = 0;
    this.carryingItem = null;
    this.isInWater = false;

    // D1: Hidden in bush
    this.isHidden = false;
    this.hiddenOpacity = 1.0;

    // D2: Crouching
    this.isCrouching = false;
    this.crouchAmount = 0;

    // F3: Crown (sandbox reward)
    this.hasCrown = false;
    this.crownMesh = null;

    this.build();
  }

  build() {
    // Body - egg shape
    const bodyGeo = createEggShape(0.35, 0.4, 0.5);
    this.body = new THREE.Mesh(bodyGeo, Mat.gooseWhite);
    this.body.position.y = 0.8;
    this.body.rotation.x = 0.15;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Neck
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.05, 0.2);
    this.group.add(this.neck);

    const neckGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.55, 8);
    const neckMesh = new THREE.Mesh(neckGeo, Mat.gooseWhite);
    neckMesh.position.y = 0.25;
    neckMesh.castShadow = true;
    this.neck.add(neckMesh);

    // Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.55, 0);
    this.neck.add(this.head);

    const headGeo = new THREE.SphereGeometry(0.14, 10, 10);
    const headMesh = new THREE.Mesh(headGeo, Mat.gooseWhite);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Beak
    const beakGeo = new THREE.ConeGeometry(0.06, 0.2, 6);
    this.beak = new THREE.Mesh(beakGeo, Mat.gooseBeak);
    this.beak.position.set(0, -0.02, 0.14);
    this.beak.rotation.x = Math.PI / 2;
    this.head.add(this.beak);

    // Beak attach point for carrying items
    this.beakTip = new THREE.Object3D();
    this.beakTip.position.set(0, -0.02, 0.28);
    this.head.add(this.beakTip);

    // Head-wear attach point (for items worn on the face, e.g. stolen glasses)
    this.headWearAttach = new THREE.Object3D();
    this.headWearAttach.position.set(0, 0.04, 0.12);
    this.head.add(this.headWearAttach);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, Mat.gooseEye);
    eyeL.position.set(-0.08, 0.04, 0.08);
    this.head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, Mat.gooseEye);
    eyeR.position.set(0.08, 0.04, 0.08);
    this.head.add(eyeR);

    // Green bobble hat
    const hatGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.12, 10);
    this.hat = new THREE.Mesh(hatGeo, Mat.gooseHatGreen);
    this.hat.position.set(0, 0.14, -0.02);
    this.hat.castShadow = true;
    this.head.add(this.hat);

    // Pom-pom
    const pomGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const pom = new THREE.Mesh(pomGeo, Mat.gooseHatGreen);
    pom.position.set(0, 0.22, -0.02);
    this.head.add(pom);

    // Scarf - wrap around neck base
    const scarfGeo = new THREE.TorusGeometry(0.12, 0.035, 6, 12);
    const scarf = new THREE.Mesh(scarfGeo, Mat.gooseScarf);
    scarf.position.set(0, 0.0, 0.0);
    scarf.rotation.x = Math.PI / 2;
    this.neck.add(scarf);

    // Scarf tails
    this.scarfTail1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.2, 0.03),
      Mat.gooseScarf
    );
    this.scarfTail1.position.set(0.05, -0.05, -0.12);
    this.neck.add(this.scarfTail1);

    this.scarfTail2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.15, 0.03),
      Mat.gooseScarf
    );
    this.scarfTail2.position.set(0.1, -0.08, -0.1);
    this.neck.add(this.scarfTail2);

    // Wings
    const wingGeo = new THREE.SphereGeometry(0.15, 8, 6);
    this.wingL = new THREE.Mesh(wingGeo, Mat.gooseWhite);
    this.wingL.scale.set(0.3, 0.6, 1);
    this.wingL.position.set(-0.3, 0.85, -0.05);
    this.wingL.castShadow = true;
    this.group.add(this.wingL);

    this.wingR = new THREE.Mesh(wingGeo, Mat.gooseWhite);
    this.wingR.scale.set(0.3, 0.6, 1);
    this.wingR.position.set(0.3, 0.85, -0.05);
    this.wingR.castShadow = true;
    this.group.add(this.wingR);

    // Tail feathers
    const tailGeo = new THREE.ConeGeometry(0.1, 0.15, 6);
    const tail = new THREE.Mesh(tailGeo, Mat.gooseWhite);
    tail.position.set(0, 0.9, -0.45);
    tail.rotation.x = -0.5;
    tail.castShadow = true;
    this.group.add(tail);

    // Legs
    this.legL = new THREE.Group();
    this.legL.position.set(-0.12, 0.35, 0);
    this.group.add(this.legL);
    const legGeoL = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6);
    const legMeshL = new THREE.Mesh(legGeoL, Mat.gooseLeg);
    legMeshL.position.y = -0.15;
    this.legL.add(legMeshL);
    const footL = createWebbedFoot(Mat.gooseLeg);
    footL.position.set(0, -0.33, 0.04);
    this.legL.add(footL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.12, 0.35, 0);
    this.group.add(this.legR);
    const legGeoR = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6);
    const legMeshR = new THREE.Mesh(legGeoR, Mat.gooseLeg);
    legMeshR.position.y = -0.15;
    this.legR.add(legMeshR);
    const footR = createWebbedFoot(Mat.gooseLeg);
    footR.position.set(0, -0.33, 0.04);
    this.legR.add(footR);

    // Ground shadow
    const shadowGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);

    // Collect all meshes for opacity changes and pre-clone materials
    this.allMeshes = [];
    this.group.traverse(child => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        this.allMeshes.push(child);
      }
    });
  }

  update(dt) {
    const walkSpeed = this.isRunning ? 12 : 6;

    // Swimming - lower body and hide legs when over water
    const swimTarget = this.isInWater ? -0.3 : 0;
    // D2: Crouch lowers body
    const crouchTarget = this.isCrouching ? -0.25 : 0;
    const targetY = swimTarget + crouchTarget;
    this.group.position.y += (targetY - this.group.position.y) * Math.min(1, 5 * dt);
    this.legL.visible = this.legR.visible = !this.isInWater;

    // D2: Crouch animation (lower body, compact posture)
    const crouchGoal = this.isCrouching ? 1 : 0;
    this.crouchAmount += (crouchGoal - this.crouchAmount) * Math.min(1, 8 * dt);
    this.body.position.y = 0.8 - this.crouchAmount * 0.2;
    this.neck.position.y = 1.05 - this.crouchAmount * 0.25;
    this.neck.rotation.x = this.isHonking ? this.neck.rotation.x : this.crouchAmount * 0.3;
    this.wingL.position.y = 0.85 - this.crouchAmount * 0.2;
    this.wingR.position.y = 0.85 - this.crouchAmount * 0.2;

    // D1: Hidden opacity
    const opacityTarget = this.isHidden ? 0.4 : 1.0;
    this.hiddenOpacity += (opacityTarget - this.hiddenOpacity) * Math.min(1, 5 * dt);
    if (Math.abs(this.hiddenOpacity - opacityTarget) > 0.01) {
      for (const mesh of this.allMeshes) {
        if (mesh.material) {
          mesh.material.opacity = this.hiddenOpacity;
        }
      }
    }

    if (this.isWalking) {
      this.walkPhase += dt * walkSpeed;
      this.idleTimer = 0;

      // Leg animation (skip when swimming - legs are hidden)
      if (!this.isInWater) {
        const legSwing = Math.sin(this.walkPhase) * 0.4;
        this.legL.rotation.x = legSwing;
        this.legR.rotation.x = -legSwing;
      }

      // Body bob
      if (!this.isCrouching) {
        this.body.position.y = 0.8 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.03;
      }

      // Head bob
      this.head.position.y = 0.55 + Math.sin(this.walkPhase * 2) * 0.02;

      // Scarf sway
      this.scarfTail1.rotation.z = Math.sin(this.walkPhase * 1.5) * 0.15;
      this.scarfTail2.rotation.z = Math.sin(this.walkPhase * 1.5 + 0.5) * 0.1;

      // Wing slight movement
      this.wingL.rotation.z = Math.sin(this.walkPhase) * 0.05;
      this.wingR.rotation.z = -Math.sin(this.walkPhase) * 0.05;
    } else {
      // Idle - return to neutral
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      if (!this.isCrouching) {
        this.body.position.y = 0.8;
      }
      this.scarfTail1.rotation.z *= 0.95;
      this.scarfTail2.rotation.z *= 0.95;

      // Idle look around
      this.idleTimer += dt;
      if (this.idleTimer > 3) {
        this.idleLookAngle = Math.sin(this.idleTimer * 0.5) * 0.3;
        this.head.rotation.y = this.idleLookAngle;
      }
    }

    // Honk animation
    if (this.isHonking) {
      this.honkTimer += dt;
      const t = this.honkTimer / 0.35;
      if (t < 1) {
        this.neck.rotation.x = Math.sin(t * Math.PI) * 0.4;
        this.head.rotation.x = Math.sin(t * Math.PI) * -0.2;
        // Open beak
        this.beak.position.y = -0.02 + Math.sin(t * Math.PI) * 0.03;
      } else {
        this.isHonking = false;
        this.honkTimer = 0;
        this.neck.rotation.x = this.isCrouching ? this.crouchAmount * 0.3 : 0;
        this.head.rotation.x = 0;
        this.beak.position.y = -0.02;
      }
    }

    // F3: Crown bob
    if (this.crownMesh) {
      this.crownMesh.rotation.y += dt * 0.5;
    }
  }

  honk() {
    this.isHonking = true;
    this.honkTimer = 0;
  }

  // D2: Set crouch state
  setCrouch(on) {
    this.isCrouching = on;
  }

  // D1: Set hidden state
  setHidden(on) {
    this.isHidden = on;
  }

  // F3: Add golden crown
  addCrown() {
    if (this.hasCrown) return;
    this.hasCrown = true;
    const crownGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.08, 5);
    this.crownMesh = new THREE.Mesh(crownGeo, Mat.bellGold);
    this.crownMesh.position.set(0, 0.28, -0.02);
    this.head.add(this.crownMesh);

    // Crown points
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const point = new THREE.Mesh(
        new THREE.ConeGeometry(0.02, 0.06, 4),
        Mat.bellGold
      );
      point.position.set(
        Math.cos(angle) * 0.1,
        0.32,
        Math.sin(angle) * 0.1 - 0.02
      );
      this.head.add(point);
    }
  }

  getPosition() {
    return this.group.position;
  }

  getWorldBeakPosition() {
    const pos = new THREE.Vector3();
    this.beakTip.getWorldPosition(pos);
    return pos;
  }

  attachToBeak(object) {
    this.beakTip.add(object);
    object.position.set(0, 0, 0);
    this.carryingItem = object;
  }

  detachFromBeak() {
    if (this.carryingItem) {
      const item = this.carryingItem;
      this.carryingItem = null;
      return item;
    }
    return null;
  }

  wearOnHead(object) {
    this.headWearAttach.add(object);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    this.carryingItem = object;
  }

  removeFromHead() {
    if (this.carryingItem) {
      const item = this.carryingItem;
      this.carryingItem = null;
      return item;
    }
    return null;
  }
}
