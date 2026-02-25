import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Ground {
  constructor() {
    this.group = new THREE.Group();
    this.build();
  }

  build() {
    // Main grass plane
    const grassGeo = new THREE.PlaneGeometry(80, 80);
    const grass = new THREE.Mesh(grassGeo, Mat.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.group.add(grass);

    // Dirt paths
    this.addPath(0, 0, 60, 2.5, 0);          // Main north-south path
    this.addPath(0, 0, 40, 2.5, Math.PI / 2); // East-west path
    this.addPath(12, -8, 15, 2, 0);           // Garden path
    this.addPath(-10, 5, 12, 1.8, 0.3);       // Pond path

    // Darker grass patches for variety
    for (let i = 0; i < 15; i++) {
      const patchGeo = new THREE.CircleGeometry(1 + Math.random() * 2, 8);
      const patch = new THREE.Mesh(patchGeo, Mat.grassDark);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (Math.random() - 0.5) * 50,
        0.005,
        (Math.random() - 0.5) * 50
      );
      patch.receiveShadow = true;
      this.group.add(patch);
    }

    // Mud puddle near the boy's area
    const puddleGeo = new THREE.CircleGeometry(1.2, 12);
    const puddleMat = new THREE.MeshToonMaterial({ color: 0x6a5030, transparent: true, opacity: 0.8 });
    this.puddle = new THREE.Mesh(puddleGeo, puddleMat);
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.set(8, 0.01, 12);
    this.puddle.name = 'puddle';
    this.group.add(this.puddle);
  }

  addPath(x, z, length, width, angle) {
    const pathGeo = new THREE.PlaneGeometry(width, length);
    const path = new THREE.Mesh(pathGeo, Mat.dirtPath);
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = angle;
    path.position.set(x, 0.01, z);
    path.receiveShadow = true;
    this.group.add(path);
  }
}
