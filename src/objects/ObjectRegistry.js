import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';
import { CarriableObject } from './CarriableObject.js';
import { Gate } from './Gate.js';
import { Bell } from './Bell.js';
import { InteractableObject } from './InteractableObject.js';

export class ObjectRegistry {
  constructor(scene, collisionManager) {
    this.scene = scene;
    this.collision = collisionManager;
    this.objects = [];
    this.carriables = [];
    this.gates = [];
    this.bells = [];

    this.build();
  }

  build() {
    // === Carriable items ===

    // Gardener's hat (straw hat near garden)
    this.gardenerHat = this.createCarriable('gardenerHat', () => {
      const g = new THREE.Group();
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.04, 10), Mat.strawHat);
      g.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 8), Mat.strawHat);
      top.position.y = 0.08;
      g.add(top);
      return g;
    }, 14, 0.5, -4);

    // Rake
    this.rake = this.createCarriable('rake', () => {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), Mat.objectWood);
      handle.rotation.x = Math.PI / 2;
      g.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.08), Mat.objectMetal);
      head.position.z = 0.6;
      g.add(head);
      for (let i = -3; i <= 3; i++) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), Mat.objectMetal);
        tine.position.set(i * 0.04, -0.05, 0.6);
        g.add(tine);
      }
      return g;
    }, 10, 0.3, -5);

    // Watering can
    this.wateringCan = this.createCarriable('wateringCan', () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 8), Mat.binGreen);
      g.add(body);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.2, 6), Mat.binGreen);
      spout.position.set(0.12, 0.08, 0);
      spout.rotation.z = -0.8;
      g.add(spout);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 8, Math.PI), Mat.binGreen);
      handle.position.set(0, 0.1, 0);
      handle.rotation.x = Math.PI / 2;
      g.add(handle);
      return g;
    }, 11, 0.2, -7);

    // Apple
    this.apple = this.createCarriable('apple', () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), Mat.appleRed);
      g.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 4), Mat.treeTrunk);
      stem.position.y = 0.1;
      g.add(stem);
      return g;
    }, -14, 0.1, 3);

    // Pumpkin
    this.pumpkin = this.createCarriable('pumpkin', () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), Mat.pumpkinOrange);
      body.scale.y = 0.8;
      g.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 4), Mat.vegGreen);
      stem.position.y = 0.13;
      g.add(stem);
      return g;
    }, 13, 0.15, -7);

    // Radio
    this.radio = this.createCarriable('radio', () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.1), Mat.metalDark);
      g.add(body);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), Mat.metal);
      antenna.position.set(0.08, 0.15, 0);
      antenna.rotation.z = -0.2;
      g.add(antenna);
      const dial = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), Mat.objectRed);
      dial.position.set(-0.06, 0, 0.05);
      g.add(dial);
      return g;
    }, -13, 0.4, 7);

    // Glasses (old lady's)
    this.glasses = this.createCarriable('glasses', () => {
      const g = new THREE.Group();
      for (const side of [-0.05, 0.05]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 12), Mat.objectMetal);
        lens.position.set(side, 0, 0);
        g.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.005), Mat.objectMetal);
      bridge.position.y = 0.01;
      g.add(bridge);
      for (const side of [-0.09, 0.09]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.12), Mat.objectMetal);
        arm.position.set(side, 0, -0.06);
        g.add(arm);
      }
      return g;
    }, -5, 0.8, 16);

    // Sandwich (picnic)
    this.sandwich = this.createCarriable('sandwich', () => {
      const g = new THREE.Group();
      const bread1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), Mat.breadTan);
      bread1.position.y = -0.02;
      g.add(bread1);
      const filling = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.13), Mat.vegGreen);
      filling.position.y = 0.01;
      g.add(filling);
      const bread2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), Mat.breadTan);
      bread2.position.y = 0.04;
      g.add(bread2);
      return g;
    }, 12, 0.05, 11.5);

    // Key
    this.key = this.createCarriable('key', () => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 10), Mat.bellGold);
      g.add(ring);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.005), Mat.bellGold);
      shaft.position.y = -0.07;
      g.add(shaft);
      return g;
    }, -16, 0.4, 5);

    // === Gates ===
    const gate1Mesh = this.createGateMesh(12, -9, 'gate1');
    this.gate1 = new Gate(gate1Mesh, 'garden1_gate', this.collision, 'garden1_gate');
    this.scene.add(gate1Mesh);
    this.gates.push(this.gate1);
    this.objects.push(this.gate1);

    const gate2Mesh = this.createGateMesh(-12, -10.5, 'gate2');
    this.gate2 = new Gate(gate2Mesh, 'garden2_gate', this.collision, 'garden2_gate');
    this.scene.add(gate2Mesh);
    this.gates.push(this.gate2);
    this.objects.push(this.gate2);

    // === Phone Booth Door ===
    const boothDoorMesh = this.createBoothDoorMesh(5, 2);
    this.boothDoor = new Gate(boothDoorMesh, 'phoneBoothDoor', this.collision, 'phoneBoothDoor', {
      startsOpen: true,
      collisionBox: { dx1: 0, dz1: -0.1, dx2: 0.9, dz2: 0.1 },
    });
    this.scene.add(boothDoorMesh);
    this.gates.push(this.boothDoor);
    this.objects.push(this.boothDoor);

    // === Pub Bell ===
    const bellMesh = this.createBellMesh(14, 2.8, 10.5);
    this.pubBell = new Bell(bellMesh, 'pubBell');
    this.scene.add(bellMesh);
    this.bells.push(this.pubBell);
    this.objects.push(this.pubBell);
  }

  createCarriable(name, buildFn, x, y, z) {
    const mesh = buildFn();
    mesh.position.set(x, y, z);
    mesh.name = name;
    this.scene.add(mesh);
    const obj = new CarriableObject(mesh, name);
    this.carriables.push(obj);
    this.objects.push(obj);
    return obj;
  }

  createGateMesh(x, z, name) {
    const gate = new THREE.Group();
    gate.name = name;

    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
    const postL = new THREE.Mesh(postGeo, Mat.fence);
    postL.position.set(-0.9, 0.5, 0);
    gate.add(postL);

    const postR = new THREE.Mesh(postGeo, Mat.fence);
    postR.position.set(0.9, 0.5, 0);
    gate.add(postR);

    // Gate door (pivots on left post)
    const door = new THREE.Group();
    door.position.set(-0.9, 0, 0);

    const railGeo = new THREE.BoxGeometry(1.8, 0.04, 0.04);
    const railTop = new THREE.Mesh(railGeo, Mat.fence);
    railTop.position.set(0.9, 0.7, 0);
    door.add(railTop);
    const railBot = new THREE.Mesh(railGeo, Mat.fence);
    railBot.position.set(0.9, 0.35, 0);
    door.add(railBot);

    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.4, 0.03),
        Mat.fence
      );
      slat.position.set(0.2 + i * 0.35, 0.52, 0);
      door.add(slat);
    }

    gate.add(door);
    gate.position.set(x, 0, z);
    return gate;
  }

  createBoothDoorMesh(boothX, boothZ) {
    const gate = new THREE.Group();
    gate.name = 'phoneBoothDoor';
    gate.position.set(boothX - 0.5, 0, boothZ + 0.5);

    const doorGeo = new THREE.BoxGeometry(0.9, 2.2, 0.05);
    const door = new THREE.Mesh(doorGeo, Mat.phoneRed);
    door.position.set(0.45, 1.1, 0);
    gate.add(door);

    return gate;
  }

  createBellMesh(x, y, z) {
    const bellGroup = new THREE.Group();
    bellGroup.name = 'pubBell';

    // Bracket
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.1),
      Mat.metalDark
    );
    bracket.position.y = 0.15;
    bellGroup.add(bracket);

    // Bell body
    const bellGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.2, 8);
    const bell = new THREE.Mesh(bellGeo, Mat.bellGold);
    bell.castShadow = true;
    bellGroup.add(bell);

    // Clapper
    const clapper = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      Mat.metalDark
    );
    clapper.position.y = -0.08;
    bellGroup.add(clapper);

    bellGroup.position.set(x, y, z);
    return bellGroup;
  }

  getAll() {
    return this.objects;
  }

  getCarriables() {
    return this.carriables;
  }

  getByName(name) {
    return this.objects.find(o => o.name === name);
  }

  update(dt) {
    for (const gate of this.gates) gate.update(dt);
    for (const bell of this.bells) bell.update(dt);
  }
}
