import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';
import { CarriableObject } from './CarriableObject.js';
import { InteractableObject } from './InteractableObject.js';
import { FireAlarm, createFireAlarmMesh } from './FireAlarm.js';

let _quietSignTexture = null;
function getQuietSignTexture() {
  if (_quietSignTexture) return _quietSignTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, 512, 56);

  ctx.fillStyle = '#202020';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 110px Georgia';
  ctx.fillText('KEEP', 256, 150);
  ctx.fillText('QUIET!', 256, 260);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  _quietSignTexture = tex;
  return tex;
}

// Registry of all interactable/carriable objects in the library level.
// Parallels ObjectRegistry.js but for library-specific items.
export class LibraryObjectRegistry {
  constructor(scene, collisionManager, library) {
    this.scene = scene;
    this.collision = collisionManager;
    this.library = library;

    this.objects = [];
    this.carriables = [];

    this.books = [];            // all colored books, in order
    this.quietSigns = [];       // all knockable sign objects

    this.build();
  }

  build() {
    this.buildColoredBooks();
    this.buildStepladder();
    this.buildFireAlarm();
    this.buildQuietSigns();
    this.buildLibrarianGlasses();
  }

  buildColoredBooks() {
    // Place a carriable colored book at every slot declared by Library.
    for (let i = 0; i < this.library.bookSlots.length; i++) {
      const slot = this.library.bookSlots[i];
      const color = slot.color;
      const mat = color === 'red' ? Mat.bookRed : Mat.bookBlue;
      const name = `libraryBook_${color}_${i}`;

      const mesh = this.createBookMesh(mat);
      mesh.position.set(slot.x, slot.y, slot.z);
      mesh.name = name;
      this.scene.add(mesh);

      const obj = new CarriableObject(mesh, name);
      obj.bookColor = color;
      obj.homeSlot = { x: slot.x, z: slot.z, shelfIndex: slot.shelf, color };
      obj.upsideDown = false;
      this.carriables.push(obj);
      this.objects.push(obj);
      this.books.push(obj);
    }
  }

  createBookMesh(colorMat) {
    const g = new THREE.Group();
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.26, 0.18),
      colorMat,
    );
    g.add(spine);
    // Page slab at the front (facing aisle)
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, 0.005),
      Mat.paper,
    );
    pages.position.set(0, 0, 0.095);
    g.add(pages);
    return g;
  }

  buildStepladder() {
    const g = new THREE.Group();
    // Two A-frame legs
    const legGeo = new THREE.BoxGeometry(0.05, 1.2, 0.05);
    const legFL = new THREE.Mesh(legGeo, Mat.shelfWood);
    legFL.position.set(-0.3, 0.6, 0.25);
    legFL.rotation.x = 0.15;
    g.add(legFL);
    const legFR = new THREE.Mesh(legGeo, Mat.shelfWood);
    legFR.position.set(0.3, 0.6, 0.25);
    legFR.rotation.x = 0.15;
    g.add(legFR);
    const legBL = new THREE.Mesh(legGeo, Mat.shelfWood);
    legBL.position.set(-0.3, 0.6, -0.25);
    legBL.rotation.x = -0.15;
    g.add(legBL);
    const legBR = new THREE.Mesh(legGeo, Mat.shelfWood);
    legBR.position.set(0.3, 0.6, -0.25);
    legBR.rotation.x = -0.15;
    g.add(legBR);
    // Steps
    for (let s = 0; s < 4; s++) {
      const y = 0.2 + s * 0.28;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.05, 0.32),
        Mat.shelfWoodDark,
      );
      step.position.set(0, y, 0);
      g.add(step);
    }
    g.name = 'stepladder';
    // Lean it up against the tall shelf at (8, 7.3)
    g.position.set(7, 0.3, 6.3);
    this.scene.add(g);

    const obj = new CarriableObject(g, 'stepladder');
    this.carriables.push(obj);
    this.objects.push(obj);
    this.stepladder = obj;
  }

  buildFireAlarm() {
    // Place on east wall inside the reading area, facing west (into the room).
    const mesh = createFireAlarmMesh(
      this.library.alarmPos.x,
      this.library.alarmPos.y,
      this.library.alarmPos.z,
      -Math.PI / 2,
    );
    this.scene.add(mesh);
    const alarm = new FireAlarm(mesh);
    this.objects.push(alarm);
    this.fireAlarm = alarm;
  }

  buildQuietSigns() {
    for (const data of this.library.quietSignData) {
      const mesh = this.createQuietSignMesh();
      mesh.position.set(data.x, data.y, data.z);
      mesh.rotation.y = data.rotY;
      mesh.name = data.id;
      this.scene.add(mesh);

      // Defense in depth: keep the goose's center off the wall surface so the
      // collision resolver never needs to disambiguate "inside two boxes" near a sign.
      // Plate is 0.8 wide × 0.04 deep; rotation puts width along world X or Z.
      const isWestEastFacing = Math.abs(Math.abs(data.rotY) - Math.PI / 2) < 0.01;
      const halfX = isWestEastFacing ? 0.02 : 0.4;
      const halfZ = isWestEastFacing ? 0.4 : 0.02;
      this.collision.addBox(
        data.x - halfX, data.z - halfZ,
        data.x + halfX, data.z + halfZ,
        data.id,
        { occludes: false },
      );

      const obj = new InteractableObject(mesh, data.id, 1.5);
      obj.knocked = false;
      obj.interact = () => {
        if (obj.knocked) return null;
        obj.knocked = true;
        // Fall: rotate around z axis so it tumbles forward
        mesh.rotation.z = Math.PI / 2;
        mesh.position.y = 0.1;
        this.collision.removeByName(data.id);
        return 'knockSign';
      };
      this.objects.push(obj);
      this.quietSigns.push(obj);
    }
  }

  createQuietSignMesh() {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.04),
      Mat.alarmWhite,
    );
    g.add(plate);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.48),
      new THREE.MeshBasicMaterial({ map: getQuietSignTexture() }),
    );
    face.position.z = 0.021;
    g.add(face);
    return g;
  }

  buildLibrarianGlasses() {
    // A spare reading-glasses pair on the desk. Carriable — the "librarian's glasses" task.
    const mesh = this.createGlassesMesh();
    mesh.position.set(this.library.desk.x, 1.13, this.library.desk.z + 0.3);
    mesh.name = 'librarianGlasses';
    this.scene.add(mesh);
    const obj = new CarriableObject(mesh, 'librarianGlasses');
    obj.attachMode = 'wear';
    this.carriables.push(obj);
    this.objects.push(obj);
    this.librarianGlasses = obj;
  }

  createGlassesMesh() {
    const g = new THREE.Group();
    for (const side of [-0.075, 0.075]) {
      const lens = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.006, 6, 12),
        Mat.objectMetal,
      );
      lens.position.set(side, 0, 0);
      g.add(lens);
    }
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.006, 0.006),
      Mat.objectMetal,
    );
    g.add(bridge);
    for (const side of [-0.105, 0.105]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.006, 0.14),
        Mat.objectMetal,
      );
      arm.position.set(side, 0, -0.07);
      g.add(arm);
    }
    return g;
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
    // Nothing animating at registry level currently — individual objects handle their own update.
  }
}
