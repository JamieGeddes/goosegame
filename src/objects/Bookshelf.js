import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

const BOOK_MATS = [Mat.bookRed, Mat.bookBlue, Mat.bookGreen, Mat.bookYellow, Mat.bookBrown];

// A tall, freestanding double-sided bookshelf. The goose can duck between aisles,
// and the whole thing can be tipped over in the finale.
//
// Children are added to an inner group so the outer group's rotation.y can be
// set freely by callers (e.g. to orient a shelf 90°) while tip() still rotates
// the shelf forward in its own local frame.
export class Bookshelf {
  constructor(x, z, options = {}) {
    this.x = x;
    this.z = z;
    this.length = options.length ?? 3.2;         // along local X
    this.depth = options.depth ?? 0.45;          // along local Z
    this.height = options.height ?? 1.9;
    this.tipDirection = options.tipDirection ?? 1; // +1 → +Z (local), -1 → -Z
    this.name = options.name || `bookshelf_${x}_${z}`;
    this.booksPerShelf = options.booksPerShelf ?? 10;
    this.shelves = options.shelves ?? 4;
    this.bookColorPattern = options.bookColorPattern || null;

    this.group = new THREE.Group();
    this.group.name = this.name;
    this.group.position.set(x, 0, z);

    this.innerGroup = new THREE.Group();
    this.group.add(this.innerGroup);

    this.tipped = false;
    this.tipTimer = 0;
    this.tipDuration = 0.55;

    this.build();
  }

  build() {
    const parent = this.innerGroup;
    // End caps
    const endGeo = new THREE.BoxGeometry(0.08, this.height, this.depth);
    for (const sx of [-this.length / 2 + 0.04, this.length / 2 - 0.04]) {
      const cap = new THREE.Mesh(endGeo, Mat.shelfWood);
      cap.position.set(sx, this.height / 2, 0);
      cap.castShadow = true;
      parent.add(cap);
    }

    // Back panel
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(this.length - 0.04, this.height, 0.04),
      Mat.shelfWoodDark,
    );
    back.position.set(0, this.height / 2, 0);
    parent.add(back);

    // Shelves + books
    const shelfGap = this.height / (this.shelves + 1);
    for (let s = 0; s < this.shelves; s++) {
      const shelfY = shelfGap * (s + 1);

      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(this.length - 0.1, 0.04, this.depth - 0.05),
        Mat.shelfWood,
      );
      shelf.position.set(0, shelfY, 0);
      shelf.castShadow = true;
      parent.add(shelf);

      const bookSpacing = (this.length - 0.3) / this.booksPerShelf;
      for (let side of [-1, 1]) {
        for (let i = 0; i < this.booksPerShelf; i++) {
          const height = 0.22 + Math.random() * 0.08;
          const width = 0.06 + Math.random() * 0.03;
          const color = this.pickBookColor(s, i, side);
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, this.depth * 0.35),
            color,
          );
          const x = -this.length / 2 + 0.2 + i * bookSpacing + (Math.random() - 0.5) * 0.01;
          const z = side * (this.depth / 2 - this.depth * 0.18);
          book.position.set(x, shelfY + 0.02 + height / 2, z);
          if (Math.random() < 0.15) book.rotation.z = (Math.random() - 0.5) * 0.3;
          parent.add(book);
        }
      }
    }

    // Top cap
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(this.length, 0.06, this.depth),
      Mat.shelfWoodDark,
    );
    top.position.set(0, this.height - 0.03, 0);
    parent.add(top);
  }

  pickBookColor(shelfIndex, i, side) {
    if (this.bookColorPattern) {
      const row = this.bookColorPattern[shelfIndex % this.bookColorPattern.length];
      const key = row[i % row.length];
      if (key === 'r') return Mat.bookRed;
      if (key === 'b') return Mat.bookBlue;
      if (key === 'g') return Mat.bookGreen;
      if (key === 'y') return Mat.bookYellow;
      return Mat.bookBrown;
    }
    return BOOK_MATS[(shelfIndex * 3 + i + (side > 0 ? 1 : 0)) % BOOK_MATS.length];
  }

  // Falls over by rotating the inner group around its bottom edge on the local
  // ±Z side. The outer group's rotation.y is preserved, so the shelf tips in
  // whatever world direction its local +Z/−Z now faces.
  tip(direction = this.tipDirection, onHalfway) {
    if (this.tipped) return;
    this.tipped = true;
    this.tipTimer = 0;
    this.tipSign = direction;
    this.onHalfway = onHalfway;
    this.didHalfway = false;
  }

  update(dt) {
    if (!this.tipped || this.tipTimer >= this.tipDuration) return;
    this.tipTimer += dt;
    const t = Math.min(this.tipTimer / this.tipDuration, 1);
    const eased = t * t;
    const angle = eased * (Math.PI / 2 - 0.05) * this.tipSign;
    this.innerGroup.rotation.x = -angle;
    // Shift inner group so the rotation pivots around the bottom-edge on the ±Z side
    const pivotZ = this.tipSign * (this.depth / 2);
    const cos = Math.cos(this.innerGroup.rotation.x);
    const sin = Math.sin(this.innerGroup.rotation.x);
    this.innerGroup.position.z = pivotZ - pivotZ * cos;
    this.innerGroup.position.y = -pivotZ * sin;
    if (!this.didHalfway && t > 0.5 && this.onHalfway) {
      this.didHalfway = true;
      this.onHalfway();
    }
  }
}
