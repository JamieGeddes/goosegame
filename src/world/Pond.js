import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Pond {
  constructor() {
    this.group = new THREE.Group();
    this.waterSurface = null;
    this.build();
  }

  build() {
    const cx = -8, cz = 10;
    this.group.position.set(cx, 0, cz);

    // Water surface
    const waterGeo = new THREE.CircleGeometry(4, 24);
    this.waterSurface = new THREE.Mesh(waterGeo, Mat.water);
    this.waterSurface.rotation.x = -Math.PI / 2;
    this.waterSurface.position.y = -0.05;
    this.waterSurface.name = 'pondWater';
    this.group.add(this.waterSurface);

    // Rock border
    const rockPositions = [];
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = 3.8 + Math.random() * 0.6;
      const rx = Math.cos(a) * r;
      const rz = Math.sin(a) * r;
      rockPositions.push({ x: rx, z: rz });

      const size = 0.2 + Math.random() * 0.3;
      const rockGeo = new THREE.SphereGeometry(size, 6, 5);
      const rock = new THREE.Mesh(rockGeo, Math.random() > 0.5 ? Mat.rock : Mat.rockDark);
      rock.position.set(rx, size * 0.3, rz);
      rock.scale.y = 0.6;
      rock.castShadow = true;
      this.group.add(rock);
    }

    // Lilypads
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1 + Math.random() * 2;
      const lilyGeo = new THREE.CircleGeometry(0.3 + Math.random() * 0.2, 8);
      const lily = new THREE.Mesh(lilyGeo, Mat.lilypad);
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(Math.cos(angle) * dist, 0.01, Math.sin(angle) * dist);
      lily.rotation.z = Math.random() * Math.PI;
      this.group.add(lily);

      // Occasional flower on lilypad
      if (Math.random() > 0.5) {
        const flowerGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const flower = new THREE.Mesh(flowerGeo, Mat.flower);
        flower.position.set(lily.position.x, 0.06, lily.position.z);
        this.group.add(flower);
      }
    }

    // Reeds along one edge
    for (let i = 0; i < 8; i++) {
      const angle = -0.5 + Math.random() * 1.2;
      const dist = 3.5 + Math.random() * 0.8;
      this.addReed(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }

    // Small bridge
    this.buildBridge();
  }

  addReed(x, z) {
    const height = 0.8 + Math.random() * 0.6;
    const reedGeo = new THREE.CylinderGeometry(0.015, 0.02, height, 4);
    const reed = new THREE.Mesh(reedGeo, Mat.reed);
    reed.position.set(x, height / 2, z);
    reed.rotation.z = (Math.random() - 0.5) * 0.15;
    this.group.add(reed);

    // Cattail top
    if (Math.random() > 0.4) {
      const topGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6);
      const top = new THREE.Mesh(topGeo, Mat.pantsBrown);
      top.position.set(x, height + 0.05, z);
      this.group.add(top);
    }
  }

  buildBridge() {
    const bridge = new THREE.Group();

    // Planks
    const plankGeo = new THREE.BoxGeometry(1.6, 0.08, 0.25);
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(plankGeo, Mat.objectWood);
      plank.position.set(0, 0.2, -2.5 + i * 0.3);
      plank.castShadow = true;
      bridge.add(plank);
    }

    // Rails
    for (const side of [-0.75, 0.75]) {
      const railGeo = new THREE.BoxGeometry(0.06, 0.06, 2);
      const rail = new THREE.Mesh(railGeo, Mat.objectWood);
      rail.position.set(side, 0.55, -1.2);
      bridge.add(rail);

      // Rail posts
      for (const pz of [-2.2, -1.2, -0.2]) {
        const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
        const post = new THREE.Mesh(postGeo, Mat.objectWood);
        post.position.set(side, 0.4, pz);
        bridge.add(post);
      }
    }

    bridge.position.set(4, 0, 0);
    bridge.rotation.y = -0.3;
    this.group.add(bridge);
  }

  // Check if a world position is over the pond water
  isOverWater(worldPos) {
    const localX = worldPos.x - this.group.position.x;
    const localZ = worldPos.z - this.group.position.z;
    return Math.sqrt(localX * localX + localZ * localZ) < 3.5;
  }

  update(dt, elapsed) {
    // Gentle water animation
    if (this.waterSurface) {
      this.waterSurface.position.y = -0.05 + Math.sin(elapsed * 0.5) * 0.02;
    }
  }
}
