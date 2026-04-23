import * as THREE from 'three';

export class CollisionManager {
  constructor() {
    this.boxes = []; // { min: {x,z}, max: {x,z}, name, occludes }
  }

  addBox(minX, minZ, maxX, maxZ, name = '', options = {}) {
    this.boxes.push({
      min: { x: Math.min(minX, maxX), z: Math.min(minZ, maxZ) },
      max: { x: Math.max(minX, maxX), z: Math.max(minZ, maxZ) },
      name,
      occludes: options.occludes === true,
    });
  }

  addBoxFromMesh(mesh, padding = 0, options = {}) {
    const box = new THREE.Box3().setFromObject(mesh);
    this.addBox(
      box.min.x - padding, box.min.z - padding,
      box.max.x + padding, box.max.z + padding,
      mesh.name || '',
      options,
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
          // Goose center sits exactly on a box edge/corner. Pick the cardinal
          // push-out that (a) doesn't land inside another collider and
          // (b) tracks the direction of motion. Without the inside-box check
          // this can shove the goose through an adjacent wall when two
          // boxes share an edge (perimeter shelf vs. outer wall).
          const mx = x - oldPos.x;
          const mz = z - oldPos.z;
          const candidates = [
            { x: box.max.x + radius, z, axis: 'x', sign: 1 },
            { x: box.min.x - radius, z, axis: 'x', sign: -1 },
            { x, z: box.max.z + radius, axis: 'z', sign: 1 },
            { x, z: box.min.z - radius, axis: 'z', sign: -1 },
          ];
          const insideAnother = (cx, cz) => {
            for (const b of this.boxes) {
              if (b === box) continue;
              if (cx > b.min.x && cx < b.max.x && cz > b.min.z && cz < b.max.z) return true;
            }
            return false;
          };
          const score = (c) => {
            const motionAlign = c.axis === 'x'
              ? (Math.sign(mx) === c.sign ? 0 : 1)
              : (Math.sign(mz) === c.sign ? 0 : 1);
            return (insideAnother(c.x, c.z) ? 10 : 0) + motionAlign;
          };
          candidates.sort((a, b) => score(a) - score(b));
          x = candidates[0].x;
          z = candidates[0].z;
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

  // Slab-method ray-vs-AABB intersection against any occluding box.
  // Used by librarian FOV to check if a bookshelf blocks line of sight.
  isLineOfSightBlocked(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) return false;
    const invDx = dx !== 0 ? 1 / dx : Infinity;
    const invDz = dz !== 0 ? 1 / dz : Infinity;

    for (const box of this.boxes) {
      if (!box.occludes) continue;

      let tMin = 0;
      let tMax = 1;

      // X slab
      if (dx === 0) {
        if (ax < box.min.x || ax > box.max.x) continue;
      } else {
        const t1 = (box.min.x - ax) * invDx;
        const t2 = (box.max.x - ax) * invDx;
        const tLo = Math.min(t1, t2);
        const tHi = Math.max(t1, t2);
        tMin = Math.max(tMin, tLo);
        tMax = Math.min(tMax, tHi);
        if (tMin > tMax) continue;
      }

      // Z slab
      if (dz === 0) {
        if (az < box.min.z || az > box.max.z) continue;
      } else {
        const t1 = (box.min.z - az) * invDz;
        const t2 = (box.max.z - az) * invDz;
        const tLo = Math.min(t1, t2);
        const tHi = Math.max(t1, t2);
        tMin = Math.max(tMin, tLo);
        tMax = Math.min(tMax, tHi);
        if (tMin > tMax) continue;
      }

      if (tMax >= 0 && tMin <= 1) return true;
    }
    return false;
  }
}
