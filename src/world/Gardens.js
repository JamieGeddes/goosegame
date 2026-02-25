import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Gardens {
  constructor(collisionManager) {
    this.group = new THREE.Group();
    this.collision = collisionManager;
    this.gates = [];
    this.build();
  }

  build() {
    this.buildGarden1(12, -6);  // Gardener's garden
    this.buildGarden2(-12, -10); // Secondary garden
  }

  buildGarden1(x, z) {
    const garden = new THREE.Group();

    // Fence posts and rails - rectangular garden 8x6
    const w = 8, h = 6;
    this.buildFence(garden, -w/2, -h/2, w/2, h/2, x, z, 'garden1_gate');

    // Vegetable beds
    this.addVegBed(garden, -2, -1, 3, 1.2);
    this.addVegBed(garden, 1.5, -1, 2.5, 1.2);
    this.addVegBed(garden, -1, 1.5, 4, 1);

    // Flower patches
    this.addFlowers(garden, 2.5, 1.5, 5);
    this.addFlowers(garden, -2.5, 2, 4);

    // Wheelbarrow
    const wb = this.buildWheelbarrow();
    wb.position.set(2, 0, -2);
    garden.add(wb);

    garden.position.set(x, 0, z);
    this.group.add(garden);
  }

  buildGarden2(x, z) {
    const garden = new THREE.Group();
    const w = 6, h = 5;
    this.buildFence(garden, -w/2, -h/2, w/2, h/2, x, z, 'garden2_gate');

    this.addVegBed(garden, 0, -0.5, 3.5, 1.5);
    this.addFlowers(garden, -1.5, 1.5, 6);

    garden.position.set(x, 0, z);
    this.group.add(garden);
  }

  buildFence(parent, x1, z1, x2, z2, worldX, worldZ, gateName) {
    const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6);
    const railGeo = new THREE.BoxGeometry(0.04, 0.04, 1);

    const posts = [];
    const sides = [
      { sx: x1, sz: z1, ex: x2, ez: z1 }, // front
      { sx: x2, sz: z1, ex: x2, ez: z2 }, // right
      { sx: x2, sz: z2, ex: x1, ez: z2 }, // back
      { sx: x1, sz: z2, ex: x1, ez: z1 }, // left
    ];

    sides.forEach((side, sideIdx) => {
      const dx = side.ex - side.sx;
      const dz = side.ez - side.sz;
      const length = Math.sqrt(dx * dx + dz * dz);
      const numPosts = Math.floor(length / 1.0);
      const angle = Math.atan2(dx, dz);

      for (let i = 0; i <= numPosts; i++) {
        const t = i / numPosts;
        const px = side.sx + dx * t;
        const pz = side.sz + dz * t;

        // Skip posts near gate location (front middle)
        if (sideIdx === 0 && Math.abs(t - 0.5) < 0.15) continue;

        const post = new THREE.Mesh(postGeo, Mat.fence);
        post.position.set(px, 0.45, pz);
        post.castShadow = true;
        parent.add(post);

        // Rails between posts
        if (i < numPosts) {
          const nextT = (i + 1) / numPosts;
          if (sideIdx === 0 && (Math.abs(t - 0.5) < 0.15 || Math.abs(nextT - 0.5) < 0.15)) continue;

          const segLen = length / numPosts;
          const midX = px + dx / numPosts * 0.5;
          const midZ = pz + dz / numPosts * 0.5;

          for (const ry of [0.3, 0.6]) {
            const rail = new THREE.Mesh(
              new THREE.BoxGeometry(0.03, 0.03, segLen),
              Mat.fence
            );
            rail.position.set(midX, ry, midZ);
            rail.rotation.y = angle;
            parent.add(rail);
          }
        }
      }

      // Collision for fence sides (except gate)
      if (sideIdx === 0) {
        // Front side - two segments with gap for gate
        const gateWidth = 2.0;
        const midX = (side.sx + side.ex) / 2;
        const midZ = side.sz;
        this.collision.addBox(
          worldX + side.sx - 0.1, worldZ + midZ - 0.1,
          worldX + midX - gateWidth/2, worldZ + midZ + 0.1,
          'fence'
        );
        this.collision.addBox(
          worldX + midX + gateWidth/2, worldZ + midZ - 0.1,
          worldX + side.ex + 0.1, worldZ + midZ + 0.1,
          'fence'
        );
        // Gate collision (removable)
        this.collision.addBox(
          worldX + midX - gateWidth/2, worldZ + midZ - 0.1,
          worldX + midX + gateWidth/2, worldZ + midZ + 0.1,
          gateName
        );
      } else {
        this.collision.addBox(
          worldX + Math.min(side.sx, side.ex) - 0.1,
          worldZ + Math.min(side.sz, side.ez) - 0.1,
          worldX + Math.max(side.sx, side.ex) + 0.1,
          worldZ + Math.max(side.sz, side.ez) + 0.1,
          'fence'
        );
      }
    });
  }

  addVegBed(parent, x, z, length, width) {
    // Dirt bed
    const bedGeo = new THREE.BoxGeometry(length, 0.15, width);
    const bed = new THREE.Mesh(bedGeo, Mat.mud);
    bed.position.set(x, 0.08, z);
    parent.add(bed);

    // Vegetables in rows
    const rows = Math.floor(width / 0.4);
    for (let r = 0; r < rows; r++) {
      const rz = z - width/2 + 0.3 + r * 0.4;
      const count = Math.floor(length / 0.5);
      for (let c = 0; c < count; c++) {
        const cx = x - length/2 + 0.3 + c * 0.5;
        const vegGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const veg = new THREE.Mesh(vegGeo, Math.random() > 0.5 ? Mat.vegGreen : Mat.vegOrange);
        veg.position.set(cx, 0.2, rz);
        parent.add(veg);

        // Leaves
        if (Math.random() > 0.3) {
          const leafGeo = new THREE.ConeGeometry(0.06, 0.12, 4);
          const leaf = new THREE.Mesh(leafGeo, Mat.vegGreen);
          leaf.position.set(cx, 0.3, rz);
          parent.add(leaf);
        }
      }
    }
  }

  addFlowers(parent, x, z, count) {
    for (let i = 0; i < count; i++) {
      const fx = x + (Math.random() - 0.5) * 1.5;
      const fz = z + (Math.random() - 0.5) * 1.5;

      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4);
      const stem = new THREE.Mesh(stemGeo, Mat.vegGreen);
      stem.position.set(fx, 0.125, fz);
      parent.add(stem);

      // Flower head
      const flowerGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const flower = new THREE.Mesh(flowerGeo,
        Math.random() > 0.5 ? Mat.flower : Mat.flowerYellow
      );
      flower.position.set(fx, 0.28, fz);
      parent.add(flower);
    }
  }

  buildWheelbarrow() {
    const wb = new THREE.Group();
    // Basin
    const basinGeo = new THREE.BoxGeometry(0.5, 0.3, 0.8);
    const basin = new THREE.Mesh(basinGeo, Mat.metal);
    basin.position.set(0, 0.35, 0);
    basin.rotation.x = -0.1;
    wb.add(basin);
    // Wheel
    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10);
    const wheel = new THREE.Mesh(wheelGeo, Mat.metalDark);
    wheel.position.set(0, 0.15, 0.5);
    wheel.rotation.x = Math.PI / 2;
    wb.add(wheel);
    // Handles
    for (const side of [-0.2, 0.2]) {
      const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
      const handle = new THREE.Mesh(handleGeo, Mat.objectWood);
      handle.position.set(side, 0.3, -0.4);
      handle.rotation.x = 0.3;
      wb.add(handle);
    }
    return wb;
  }
}
