import * as THREE from 'three';

export class CollisionManager {
  constructor() {
    this.boxes = []; // { min: {x,z}, max: {x,z}, name }
  }

  addBox(minX, minZ, maxX, maxZ, name = '') {
    this.boxes.push({
      min: { x: Math.min(minX, maxX), z: Math.min(minZ, maxZ) },
      max: { x: Math.max(minX, maxX), z: Math.max(minZ, maxZ) },
      name,
    });
  }

  addBoxFromMesh(mesh, padding = 0) {
    const box = new THREE.Box3().setFromObject(mesh);
    this.addBox(
      box.min.x - padding, box.min.z - padding,
      box.max.x + padding, box.max.z + padding,
      mesh.name || ''
    );
  }

  // Returns resolved position after sliding against walls
  resolve(oldPos, newPos, radius = 0.3) {
    let x = newPos.x;
    let z = newPos.z;

    for (const box of this.boxes) {
      const nearX = Math.max(box.min.x, Math.min(x, box.max.x));
      const nearZ = Math.max(box.min.z, Math.min(z, box.max.z));
      const dx = x - nearX;
      const dz = z - nearZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius) {
        if (dist === 0) {
          // Inside box - push out in direction of movement
          const mx = x - oldPos.x;
          const mz = z - oldPos.z;
          if (Math.abs(mx) > Math.abs(mz)) {
            x = mx > 0 ? box.max.x + radius : box.min.x - radius;
          } else {
            z = mz > 0 ? box.max.z + radius : box.min.z - radius;
          }
        } else {
          const overlap = radius - dist;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        }
      }
    }

    return { x, z };
  }

  // Remove boxes by name (for gates that open)
  removeByName(name) {
    this.boxes = this.boxes.filter(b => b.name !== name);
  }

  hasBox(name) {
    return this.boxes.some(b => b.name === name);
  }
}
