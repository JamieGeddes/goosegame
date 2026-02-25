import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Trees {
  constructor(collisionManager) {
    this.group = new THREE.Group();
    this.collision = collisionManager;
    this.build();
  }

  build() {
    // Scattered trees around village
    const treePositions = [
      { x: -18, z: -20, s: 1.2 },
      { x: -22, z: -5, s: 1.0 },
      { x: -20, z: 15, s: 1.3 },
      { x: -5, z: -22, s: 0.9 },
      { x: 5, z: -25, s: 1.1 },
      { x: 20, z: -20, s: 1.0 },
      { x: 22, z: 0, s: 1.2 },
      { x: 22, z: 15, s: 0.8 },
      { x: -15, z: 22, s: 1.1 },
      { x: 5, z: 22, s: 0.9 },
      { x: -25, z: 0, s: 1.0 },
      { x: 18, z: -10, s: 1.1 },
    ];

    treePositions.forEach(({ x, z, s }) => {
      this.addTree(x, z, s);
    });

    // Bushes around the village
    const bushPositions = [
      { x: -6, z: -12, s: 0.8 },
      { x: 6, z: -8, s: 0.6 },
      { x: -14, z: 0, s: 0.7 },
      { x: 18, z: 5, s: 0.9 },
      { x: -3, z: 18, s: 0.7 },
      { x: 8, z: 18, s: 0.6 },
      { x: -20, z: -12, s: 0.8 },
      { x: -8, z: -18, s: 0.5 },
      { x: 15, z: -14, s: 0.7 },
      { x: -18, z: 10, s: 0.6 },
      { x: 3, z: -15, s: 0.5 },
      { x: -2, z: 5, s: 0.4 },
    ];

    bushPositions.forEach(({ x, z, s }) => {
      this.addBush(x, z, s);
    });
  }

  addTree(x, z, scale = 1) {
    const tree = new THREE.Group();

    // Trunk
    const trunkH = 2 * scale;
    const trunkGeo = new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, Mat.treeTrunk);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Canopy - layered cones
    const canopyMats = [Mat.treeLeaf, Mat.treeLeafDark, Mat.treeLeaf];
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const coneR = (1.5 - i * 0.3) * scale;
      const coneH = (1.5 - i * 0.2) * scale;
      const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8);
      const cone = new THREE.Mesh(coneGeo, canopyMats[i]);
      cone.position.y = trunkH + 0.3 * scale + i * 0.7 * scale;
      cone.castShadow = true;
      tree.add(cone);
    }

    tree.position.set(x, 0, z);
    this.group.add(tree);
    this.collision.addBox(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 'tree');
  }

  addBush(x, z, scale = 1) {
    const bush = new THREE.Group();

    // Cluster of spheres
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const r = (0.3 + Math.random() * 0.3) * scale;
      const geo = new THREE.SphereGeometry(r, 8, 6);
      const sphere = new THREE.Mesh(geo, Math.random() > 0.3 ? Mat.bush : Mat.treeLeafDark);
      sphere.position.set(
        (Math.random() - 0.5) * 0.4 * scale,
        r * 0.7,
        (Math.random() - 0.5) * 0.4 * scale
      );
      sphere.castShadow = true;
      bush.add(sphere);
    }

    bush.position.set(x, 0, z);
    this.group.add(bush);

    if (scale > 0.5) {
      this.collision.addBox(x - 0.5 * scale, z - 0.5 * scale, x + 0.5 * scale, z + 0.5 * scale, 'bush');
    }
  }
}
