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
    const hat = new THREE.Mesh(hatGeo, Mat.gooseHatGreen);
    hat.position.set(0, 0.14, -0.02);
    hat.castShadow = true;
    this.head.add(hat);

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
  }

  update(dt) {
    const walkSpeed = this.isRunning ? 12 : 6;

    // Swimming — lower body and hide legs when over water
    const targetY = this.isInWater ? -0.3 : 0;
    this.group.position.y += (targetY - this.group.position.y) * Math.min(1, 5 * dt);
    this.legL.visible = this.legR.visible = !this.isInWater;

    if (this.isWalking) {
      this.walkPhase += dt * walkSpeed;
      this.idleTimer = 0;

      // Leg animation (skip when swimming — legs are hidden)
      if (!this.isInWater) {
        const legSwing = Math.sin(this.walkPhase) * 0.4;
        this.legL.rotation.x = legSwing;
        this.legR.rotation.x = -legSwing;
      }

      // Body bob
      this.body.position.y = 0.8 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.03;

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
      this.body.position.y = 0.8;
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
        this.neck.rotation.x = 0;
        this.head.rotation.x = 0;
        this.beak.position.y = -0.02;
      }
    }
  }

  honk() {
    this.isHonking = true;
    this.honkTimer = 0;
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
}
