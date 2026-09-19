import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Mat } from '../utils/Materials.js';
import gooseModelUrl from '../assets/goose.glb?url';

// The rig is authored in Blender units and stands 4.83 tall; the game wants a
// goose about 1.87 tall. Everything inside the model runs at MODEL_SCALE, so
// UNIT converts a game-space distance into the rig's own scale.
const MODEL_SCALE = 0.387;
const UNIT = 1 / MODEL_SCALE;

// Exported material name -> game toon material. The model carries no textures,
// so swapping the materials is all that is needed to keep the toon look.
const MATERIALS = {
  feather: 'gooseWhite',
  orange: 'gooseLeg',
  eye: 'gooseEye',
  green: 'gooseHatGreen',
  teal: 'gooseHatBand',
  pom: 'gooseHatPom',
};

// Beak tip in head-bone space, converted to game units.
const BEAK_TIP = new THREE.Vector3(0, 0.04, 0.30);

let modelPromise = null;
let modelScene = null;

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

export class Goose {
  // Fetches and parses the .glb once. Must resolve before constructing a Goose.
  static preload() {
    if (!modelPromise) {
      modelPromise = new Promise((resolve, reject) => {
        new GLTFLoader().load(
          gooseModelUrl,
          gltf => {
            modelScene = gltf.scene;
            resolve(modelScene);
          },
          undefined,
          reject
        );
      });
    }
    return modelPromise;
  }

  constructor() {
    if (!modelScene) {
      throw new Error('Goose.preload() must resolve before a Goose is constructed');
    }

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

    // Pose values the rig is driven from each frame
    this.legSwing = 0;
    this.wingSwing = 0;
    this.headYaw = 0;

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
    // SkeletonUtils.clone keeps the skinned meshes bound to their own skeleton
    const model = cloneRigged(modelScene);
    model.scale.setScalar(MODEL_SCALE);
    this.group.add(model);

    // Bones: root, body, legL, footL, legR, footR, neck1, neck2, head, wingL,
    // wingR. Their rest transforms are kept so poses can be applied as deltas
    // (see setBoneRotation).
    this.bones = {};
    this.restQuat = new Map();
    this.restPos = new Map();

    this.allMeshes = [];

    model.traverse(child => {
      if (child.isBone) {
        this.bones[child.name] = child;
        this.restQuat.set(child.name, child.quaternion.clone());
        this.restPos.set(child.name, child.position.clone());
      }

      if (child.isMesh) {
        const mat = Mat[MATERIALS[child.material.name]] || Mat.gooseWhite;
        child.material = mat.clone();
        child.material.transparent = true;
        child.castShadow = true;
        this.allMeshes.push(child);
      }
    });

    // Attach points hang off the head bone, counter-scaled so carried items
    // keep their own size regardless of MODEL_SCALE.
    this.headAttach = new THREE.Object3D();
    this.headAttach.scale.setScalar(UNIT);
    this.bones.head.add(this.headAttach);

    this.beakTip = new THREE.Object3D();
    this.beakTip.position.copy(BEAK_TIP);
    this.headAttach.add(this.beakTip);

    // Ground shadow
    const shadowGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);
  }

  // Poses are applied as a delta in the parent's frame, because the rig's rest
  // orientations are not axis-aligned: the leg bones point down and the wings
  // are tilted, so writing bone.rotation directly would snap them.
  setBoneRotation(name, x = 0, y = 0, z = 0) {
    const bone = this.bones[name];
    _euler.set(x, y, z);
    bone.quaternion.copy(_quat.setFromEuler(_euler)).multiply(this.restQuat.get(name));
  }

  // Offset from the bone's rest position, given in game units.
  setBoneOffset(name, x = 0, y = 0, z = 0) {
    const rest = this.restPos.get(name);
    this.bones[name].position.set(
      rest.x + x * UNIT,
      rest.y + y * UNIT,
      rest.z + z * UNIT
    );
  }

  update(dt) {
    const walkSpeed = this.isRunning ? 12 : 6;

    // Swimming - lower the goose into the water
    const swimTarget = this.isInWater ? -0.3 : 0;
    // D2: Crouch lowers body
    const crouchTarget = this.isCrouching ? -0.25 : 0;
    const targetY = swimTarget + crouchTarget;
    this.group.position.y += (targetY - this.group.position.y) * Math.min(1, 5 * dt);

    // Legs are part of the skinned mesh so they cannot simply be hidden when
    // swimming: collapse the leg bones and let the waterline cover the join.
    const legScale = this.isInWater ? 0.001 : 1;
    this.bones.legL.scale.setScalar(legScale);
    this.bones.legR.scale.setScalar(legScale);

    // D2: Crouch animation (lower body, compact posture)
    const crouchGoal = this.isCrouching ? 1 : 0;
    this.crouchAmount += (crouchGoal - this.crouchAmount) * Math.min(1, 8 * dt);

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

    let bodyBob = 0;
    let headBob = 0;

    if (this.isWalking) {
      this.walkPhase += dt * walkSpeed;
      this.idleTimer = 0;

      // Leg animation (skip when swimming - the legs are tucked away)
      this.legSwing = this.isInWater ? this.legSwing * 0.9 : Math.sin(this.walkPhase) * 0.4;

      // Body bob
      if (!this.isCrouching) {
        bodyBob = Math.abs(Math.sin(this.walkPhase * 2)) * 0.03;
      }

      // Head bob
      headBob = Math.sin(this.walkPhase * 2) * 0.02;

      // Wing slight movement
      this.wingSwing = Math.sin(this.walkPhase) * 0.05;
    } else {
      // Idle - return to neutral
      this.legSwing *= 0.9;
      this.wingSwing *= 0.9;

      // Idle look around
      this.idleTimer += dt;
      if (this.idleTimer > 3) {
        this.idleLookAngle = Math.sin(this.idleTimer * 0.5) * 0.3;
        this.headYaw = this.idleLookAngle;
      }
    }

    // Honk animation. The beak is skinned to the head bone rather than being a
    // separate part, so the neck thrusts and the head cranes up instead of the
    // beak opening.
    let neckPitch = this.crouchAmount * 0.3;
    let neckStretch = 0;
    let headPitch = 0;

    if (this.isHonking) {
      this.honkTimer += dt;
      const t = this.honkTimer / 0.35;
      if (t < 1) {
        const swell = Math.sin(t * Math.PI);
        neckPitch = swell * 0.4;
        neckStretch = swell * 0.15;
        headPitch = swell * -0.3;
      } else {
        this.isHonking = false;
        this.honkTimer = 0;
      }
    }

    // Drop the body to crouch and bob, then lift the legs by the same amount so
    // the feet stay on the ground and the goose squats onto them.
    const bodyDrop = bodyBob - this.crouchAmount * 0.2;
    this.setBoneOffset('body', 0, bodyDrop);
    this.setBoneOffset('legL', 0, -bodyDrop);
    this.setBoneOffset('legR', 0, -bodyDrop);
    this.setBoneOffset('head', 0, headBob);

    this.setBoneRotation('legL', this.legSwing);
    this.setBoneRotation('legR', -this.legSwing);
    this.setBoneRotation('wingL', 0, 0, this.wingSwing);
    this.setBoneRotation('wingR', 0, 0, -this.wingSwing);
    this.setBoneRotation('neck1', neckPitch);
    this.setBoneRotation('neck2', neckStretch);
    this.setBoneRotation('head', headPitch, this.headYaw, 0);

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

  // F3: Add golden crown - sized to ride over the bobble hat
  addCrown() {
    if (this.hasCrown) return;
    this.hasCrown = true;
    const crownGeo = new THREE.CylinderGeometry(0.2, 0.23, 0.1, 5);
    this.crownMesh = new THREE.Mesh(crownGeo, Mat.bellGold);
    this.crownMesh.position.set(0, 0.3, 0);
    this.headAttach.add(this.crownMesh);

    // Crown points
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const point = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.09, 4),
        Mat.bellGold
      );
      point.position.set(
        Math.cos(angle) * 0.2,
        0.38,
        Math.sin(angle) * 0.2
      );
      this.headAttach.add(point);
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
}
