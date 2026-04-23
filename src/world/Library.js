import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';
import { Bookshelf } from '../objects/Bookshelf.js';

// A small, cosy village library. Interior 22×24 with an east-wall jog for a
// bay window alcove. Wooden floor, coloured rugs, cream walls. The four
// tippable bookshelves zig-zag through the main room (shelves 1 and 3 are
// rotated 90°) so the domino chain reads as chaos across the room rather
// than a civic aisle of parallel rows.
export class Library {
  constructor(scene, collisionManager) {
    this.scene = scene;
    this.collision = collisionManager;
    this.group = new THREE.Group();

    this.bookshelves = [];
    this.readerSeats = [];
    this.quietSignData = [];
    this.bookSlots = [];
    this.readingChairs = [];
    this.outerWalls = [];

    this.entrancePos = { x: 0, z: -16 };
    this.lobbyCenter = { x: -3, z: -13 };
    this.desk = { x: -7, z: -13 };
    this.alarmPos = { x: 10.79, y: 1.5, z: -4 };
    this.finaleShelfIndex = 0;

    this.bounds = { minX: -11, maxX: 11, minZ: -16, maxZ: 8 };

    this.build();
    this.scene.add(this.group);
  }

  build() {
    this.buildFloors();
    this.buildOuterWalls();
    this.buildLobby();
    this.buildAisles();
    this.buildPerimeterShelves();
    this.buildReadingArea();
    this.buildTallShelf();
    this.buildWallProps();
    this.buildDecor();
  }

  buildFloors() {
    // Outdoor grass apron
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      Mat.grass,
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.01;
    apron.receiveShadow = true;
    this.group.add(apron);

    // Small stone stoop outside the door (replaces the 3-step marble entrance)
    const stoop = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2),
      Mat.wallStone,
    );
    stoop.rotation.x = -Math.PI / 2;
    stoop.position.set(0, 0.005, -17.2);
    this.group.add(stoop);

    // Wood floorboards — the interior base
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 24),
      Mat.floorWood,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, -4);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Bay window alcove floor extension (to fill the east-wall jog)
    const bay = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 5),
      Mat.floorWood,
    );
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(11.5, 0.011, 0.5);
    this.group.add(bay);

    // Rugs — each is a main plane + slightly larger border plane beneath
    this.addRug(0, -15, 3.5, 1.5, Mat.rugBlue);      // entrance mat
    this.addRug(-1, -11, 5, 4, Mat.rugRed);          // central rug
    this.addRug(9, 0, 3.5, 3.5, Mat.rugGreen);       // reading nook
    this.addRug(-8, 5, 2.5, 2.5, Mat.rugRed);        // children's corner
  }

  addRug(cx, cz, w, h, mainMat) {
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.2, h + 0.2),
      Mat.rugBorder,
    );
    border.rotation.x = -Math.PI / 2;
    border.position.set(cx, 0.014, cz);
    this.group.add(border);
    const main = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      mainMat,
    );
    main.rotation.x = -Math.PI / 2;
    main.position.set(cx, 0.018, cz);
    this.group.add(main);
  }

  buildOuterWalls() {
    const wallMat = Mat.wallCream;
    const wallHeight = 3.2;

    const addWall = (x1, z1, x2, z2, name) => {
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const isX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
      const geo = isX
        ? new THREE.BoxGeometry(len, wallHeight, 0.3)
        : new THREE.BoxGeometry(0.3, wallHeight, len);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(cx, wallHeight / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.outerWalls.push(mesh);
      const halfX = isX ? len / 2 : 0.15;
      const halfZ = isX ? 0.15 : len / 2;
      this.collision.addBox(
        cx - halfX, cz - halfZ, cx + halfX, cz + halfZ,
        name,
        { occludes: true },
      );
    };

    // North wall
    addWall(-11, 8, 11, 8, 'libNorth');
    // West wall
    addWall(-11, -16, -11, 8, 'libWest');
    // East wall split by the bay window jog
    addWall(11, -16, 11, -2, 'libEastS');        // south segment
    addWall(11, 3, 11, 8, 'libEastN');           // north segment
    addWall(11, -2, 12, -2, 'libEastJogS');      // south face of jog
    addWall(12, -2, 12, 3, 'libEastBay');        // outer face of bay
    addWall(11, 3, 12, 3, 'libEastJogN');        // north face of jog
    // South wall with doorway gap around x=0
    addWall(-11, -16, -1.5, -16, 'libSouthL');
    addWall(1.5, -16, 11, -16, 'libSouthR');

    // Cottage door frame
    const postGeo = new THREE.BoxGeometry(0.15, 2.2, 0.15);
    for (const px of [-1.1, 1.1]) {
      const post = new THREE.Mesh(postGeo, Mat.shelfWoodDark);
      post.position.set(px, 1.1, -16);
      this.group.add(post);
    }
    const doorLintel = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.2, 0.3),
      Mat.shelfWoodDark,
    );
    doorLintel.position.set(0, 2.3, -16);
    this.group.add(doorLintel);
    // Short wall above the door (between door lintel and ceiling)
    const above = new THREE.Mesh(
      new THREE.BoxGeometry(3, wallHeight - 2.4, 0.3),
      wallMat,
    );
    above.position.set(0, 2.4 + (wallHeight - 2.4) / 2, -16);
    this.group.add(above);
    this.outerWalls.push(above);

    // Hanging wooden sign outside the door
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.2),
      Mat.shelfWoodDark,
    );
    bracket.position.set(-0.8, 2.8, -16.7);
    this.group.add(bracket);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 0.08),
      Mat.signWood,
    );
    signBoard.position.set(-0.8, 2.25, -17.25);
    this.group.add(signBoard);
    // Two tiny chains
    for (const cx of [-0.5, -1.1]) {
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4),
        Mat.metalDark,
      );
      chain.position.set(cx, 2.7, -17.25);
      this.group.add(chain);
    }
    // Book-shaped dark rectangle on the sign (vague "LIBRARY")
    const signText = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.25, 0.02),
      Mat.signBlack,
    );
    signText.position.set(-0.8, 2.25, -17.21);
    this.group.add(signText);

    // Flanking windows
    for (const wx of [-3.2, 3.2]) {
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 0.05),
        Mat.windowBlue,
      );
      glass.position.set(wx, 1.7, -16);
      this.group.add(glass);
      // Frame
      const frameGeo = new THREE.BoxGeometry(1.3, 0.12, 0.1);
      for (const fy of [1.1, 2.3]) {
        const frame = new THREE.Mesh(frameGeo, Mat.windowFrame);
        frame.position.set(wx, fy, -16);
        this.group.add(frame);
      }
      for (const fx of [wx - 0.6, wx + 0.6]) {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 1.3, 0.1),
          Mat.windowFrame,
        );
        frame.position.set(fx, 1.7, -16);
        this.group.add(frame);
      }
      // Mullions
      const vMull = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.1, 0.06),
        Mat.windowFrame,
      );
      vMull.position.set(wx, 1.7, -16);
      this.group.add(vMull);
      const hMull = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.05, 0.06),
        Mat.windowFrame,
      );
      hMull.position.set(wx, 1.7, -16);
      this.group.add(hMull);
    }

    // Window box under left window
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.25, 0.3),
      Mat.shelfWood,
    );
    box.position.set(-3.2, 1.0, -16.2);
    this.group.add(box);
    for (const fx of [-3.5, -3.2, -2.9]) {
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        fx === -3.2 ? Mat.flower : Mat.flowerYellow,
      );
      flower.position.set(fx, 1.18, -16.2);
      this.group.add(flower);
    }

    // Small bench under right window
    const benchSeat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.08, 0.35),
      Mat.bench,
    );
    benchSeat.position.set(3.2, 0.45, -16.5);
    this.group.add(benchSeat);
    for (const bx of [3.2 - 0.6, 3.2 + 0.6]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.45, 0.3),
        Mat.shelfWoodDark,
      );
      leg.position.set(bx, 0.225, -16.5);
      this.group.add(leg);
    }

    // Bushes flanking entrance
    for (const bx of [-4.2, 4.2]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), Mat.bush);
      bush.scale.set(1, 0.8, 1);
      bush.position.set(bx, 0.5, -16.4);
      bush.castShadow = true;
      this.group.add(bush);
      this.collision.addBox(bx - 0.5, -16.9, bx + 0.5, -15.9, 'libBush');
    }
  }

  buildLobby() {
    // Small welcoming counter along the south-west area
    const desk = new THREE.Group();
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.1, 0.9),
      Mat.shelfWood,
    );
    deskTop.position.y = 1.0;
    deskTop.castShadow = true;
    desk.add(deskTop);
    const deskFront = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.0, 0.1),
      Mat.shelfWoodDark,
    );
    deskFront.position.set(0, 0.5, 0.4);
    desk.add(deskFront);
    const deskSide = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.0, 0.9),
      Mat.shelfWoodDark,
    );
    deskSide.position.set(1.05, 0.5, 0);
    desk.add(deskSide);
    const deskSide2 = deskSide.clone();
    deskSide2.position.x = -1.05;
    desk.add(deskSide2);

    // Stamp + stack of books on top
    const stamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8),
      Mat.objectWood,
    );
    stamp.position.set(0.7, 1.13, 0);
    desk.add(stamp);
    const stack = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.3),
      Mat.bookGreen,
    );
    stack.position.set(-0.8, 1.14, 0);
    desk.add(stack);

    desk.position.set(this.desk.x, 0, this.desk.z);
    this.group.add(desk);
    this.collision.addBox(
      this.desk.x - 1.15, this.desk.z - 0.5,
      this.desk.x + 1.15, this.desk.z + 0.5,
      'libDesk',
      { occludes: true },
    );

    // Desk chair (behind the desk, facing south toward the counter front)
    const chair = this.createChair();
    chair.position.set(this.desk.x, 0, this.desk.z - 0.7);
    chair.rotation.y = 0;
    this.group.add(chair);

    // Cardigan draped over the chair back
    const cardigan = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.6, 0.08),
      Mat.cardigan,
    );
    cardigan.position.set(this.desk.x, 0.75, this.desk.z - 0.97);
    cardigan.rotation.x = 0.1;
    this.group.add(cardigan);
  }

  buildAisles() {
    // Zig-zag chain of 4 tippable shelves. Each lands on the next when tipped.
    const config = [
      { x: -5, z: -7, rotY: 0,        length: 8, pattern: makePattern('r') },
      { x: -2, z: -3, rotY: Math.PI / 2, length: 7, pattern: makePattern('b') },
      { x:  3, z: -1, rotY: 0,        length: 7, pattern: null },
      { x:  5, z:  3, rotY: Math.PI / 2, length: 6, pattern: null },
    ];
    const shelfDepth = 0.8;
    const shelfHeight = 1.7;

    for (let i = 0; i < config.length; i++) {
      const c = config[i];
      const bookshelf = new Bookshelf(c.x, c.z, {
        length: c.length,
        depth: shelfDepth,
        height: shelfHeight,
        name: `bookshelf_${i}`,
        bookColorPattern: c.pattern,
        booksPerShelf: 10,
        tipDirection: 1,
      });
      bookshelf.group.rotation.y = c.rotY;
      this.bookshelves.push(bookshelf);
      this.group.add(bookshelf.group);

      // Collision AABB — dimensions swap for π/2 rotated shelves
      const isRotated = Math.abs(c.rotY - Math.PI / 2) < 0.01;
      const halfX = isRotated ? shelfDepth / 2 : c.length / 2;
      const halfZ = isRotated ? c.length / 2 : shelfDepth / 2;
      this.collision.addBox(
        c.x - halfX, c.z - halfZ,
        c.x + halfX, c.z + halfZ,
        bookshelf.name,
        { occludes: true },
      );
    }

    // Book slots for shelf_0 (red, north face) and shelf_1 (blue, east face)
    const shelf0 = config[0];
    const shelf1 = config[1];
    const slotOffsets = [-2.5, 0, 2.5];
    // Red books on shelf_0's +Z (north) face
    for (const ox of slotOffsets) {
      this.bookSlots.push({
        shelf: 0,
        color: 'red',
        x: shelf0.x + ox,
        y: 1.35,
        z: shelf0.z + shelfDepth / 2 + 0.05,
      });
    }
    // Blue books on shelf_1's +X (east) face — shelf is rotated π/2, so local
    // X spans along world -Z and local +Z faces world +X
    for (const ox of slotOffsets) {
      this.bookSlots.push({
        shelf: 1,
        color: 'blue',
        x: shelf1.x + shelfDepth / 2 + 0.05,
        y: 1.35,
        z: shelf1.z - ox,
      });
    }
  }

  buildPerimeterShelves() {
    // Non-tippable decorative shelves on west and north walls. Built with the
    // same Bookshelf geometry but never pushed into this.bookshelves, so the
    // finale cascade never touches them.
    const perimeter = [
      { x: -10.55, z: -6, rotY: -Math.PI / 2, length: 4 }, // west, back on -X wall
      { x: -10.55, z: -2, rotY: -Math.PI / 2, length: 4 },
      { x: -10.55, z:  2, rotY: -Math.PI / 2, length: 4 },
      { x: -2,     z:  7.55, rotY: Math.PI,   length: 8 }, // north wall
    ];
    const depth = 0.6;
    const height = 1.7;
    for (const p of perimeter) {
      const shelf = new Bookshelf(p.x, p.z, {
        length: p.length,
        depth,
        height,
        name: `perimShelf_${p.x}_${p.z}`,
        booksPerShelf: Math.round(p.length * 1.3),
        shelves: 4,
      });
      shelf.group.rotation.y = p.rotY;
      this.group.add(shelf.group);

      const isX = Math.abs(p.rotY) < 0.01 || Math.abs(p.rotY - Math.PI) < 0.01;
      const halfX = isX ? p.length / 2 : depth / 2;
      const halfZ = isX ? depth / 2 : p.length / 2;
      this.collision.addBox(
        p.x - halfX, p.z - halfZ,
        p.x + halfX, p.z + halfZ,
        shelf.name,
        { occludes: true },
      );
    }
  }

  buildReadingArea() {
    // 1. Bay window armchair (cosy single seat)
    const armchair = this.createArmchair();
    armchair.position.set(9.5, 0, 0.5);
    armchair.rotation.y = -Math.PI / 2;
    this.group.add(armchair);
    this.collision.addBox(9.1, 0.1, 9.9, 0.9, 'libArmchair');
    this.readingChairs.push(armchair);
    this.readerSeats.push({ x: 9.5, z: 0.5, facing: -Math.PI / 2 });

    // Little side table beside the armchair with a lamp + book
    const sideTable = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.6),
      Mat.shelfWood,
    );
    sideTable.position.set(10.4, 0.6, -0.8);
    this.group.add(sideTable);
    for (const lx of [-0.22, 0.22]) {
      for (const lz of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.6, 0.04),
          Mat.shelfWoodDark,
        );
        leg.position.set(10.4 + lx, 0.3, -0.8 + lz);
        this.group.add(leg);
      }
    }
    this.addTableLamp(10.4, 0.63, -0.8);

    // 2. Shared study table (two readers facing each other)
    const sharedTable = new THREE.Group();
    const sharedTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.05, 0.9),
      Mat.shelfWood,
    );
    sharedTop.position.y = 0.8;
    sharedTop.castShadow = true;
    sharedTable.add(sharedTop);
    for (const tx of [-0.6, 0.6]) {
      for (const tz of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.8, 0.06),
          Mat.shelfWoodDark,
        );
        leg.position.set(tx, 0.4, tz);
        sharedTable.add(leg);
      }
    }
    sharedTable.position.set(4, 0, -10);
    this.group.add(sharedTable);
    this.collision.addBox(3.3, -10.45, 4.7, -9.55, 'libSharedTable');
    this.addTableLamp(4, 0.83, -10);
    const sharedBook = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.04, 0.22),
      Mat.bookYellow,
    );
    sharedBook.position.set(4 - 0.3, 0.85, -10 + 0.1);
    sharedBook.rotation.y = 0.2;
    this.group.add(sharedBook);

    // South-side chair (reader 2) — saved as readingChairs[1] for finale use
    const chairS = this.createChair();
    chairS.position.set(3.4, 0, -10 - 0.8);
    chairS.rotation.y = 0;
    this.group.add(chairS);
    this.readingChairs.push(chairS);
    this.readerSeats.push({ x: 3.4, z: -10 - 0.75, facing: 0 });

    // North-side chair (reader 3)
    const chairN = this.createChair();
    chairN.position.set(4.6, 0, -10 + 0.8);
    chairN.rotation.y = Math.PI;
    this.group.add(chairN);
    this.readingChairs.push(chairN);
    this.readerSeats.push({ x: 4.6, z: -10 + 0.75, facing: Math.PI });

    // 3. Children's corner carrel (low desk + stool)
    const carrel = new THREE.Group();
    const carrelTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.05, 0.7),
      Mat.shelfWood,
    );
    carrelTop.position.y = 0.55;
    carrel.add(carrelTop);
    for (const tx of [-0.5, 0.5]) {
      for (const tz of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.55, 0.05),
          Mat.shelfWoodDark,
        );
        leg.position.set(tx, 0.275, tz);
        carrel.add(leg);
      }
    }
    carrel.position.set(-8, 0, 5.5);
    this.group.add(carrel);
    this.collision.addBox(-8.6, 5.15, -7.4, 5.85, 'libCarrel');

    // Low stool (reader 4)
    const stool = new THREE.Group();
    const stoolSeat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.05, 0.5),
      Mat.shelfWood,
    );
    stoolSeat.position.y = 0.3;
    stool.add(stoolSeat);
    for (const lx of [-0.2, 0.2]) {
      for (const lz of [-0.2, 0.2]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.3, 0.04),
          Mat.shelfWoodDark,
        );
        leg.position.set(lx, 0.15, lz);
        stool.add(leg);
      }
    }
    stool.position.set(-8, 0, 6.2);
    this.group.add(stool);
    this.readingChairs.push(stool);
    this.readerSeats.push({ x: -8, z: 6.2, facing: Math.PI });

    // Cushion blobs on the green rug
    for (const c of [{ x: -9, z: 5, m: Mat.rugBlue }, { x: -7.2, z: 4.5, m: Mat.rugRed }]) {
      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.5),
        c.m,
      );
      cushion.position.set(c.x, 0.06, c.z);
      this.group.add(cushion);
    }

    // Reorder so finale chair pick is the south-side shared-table chair.
    // world.readingChairs[0] is read by the finale in libraryLevel. Put
    // chairS first (natural "carry a chair" pick) but keep other chairs.
    const reordered = [chairS, armchair, chairN, stool];
    this.readingChairs = reordered;
  }

  addTableLamp(x, y, z) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.05, 8),
      Mat.metalDark,
    );
    base.position.set(x, y, z);
    this.group.add(base);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6),
      Mat.metalDark,
    );
    pole.position.set(x, y + 0.2, z);
    this.group.add(pole);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.18, 8, 1, true),
      Mat.bookRed,
    );
    shade.position.set(x, y + 0.45, z);
    this.group.add(shade);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      Mat.lampGlow,
    );
    glow.position.set(x, y + 0.39, z);
    this.group.add(glow);
  }

  buildTallShelf() {
    const tx = 8, tz = 7.3;
    const tall = new Bookshelf(tx, tz, {
      length: 2.4,
      depth: 0.6,
      height: 2.6,
      name: 'tallShelf',
      booksPerShelf: 8,
      shelves: 5,
      tipDirection: 1,
    });
    this.group.add(tall.group);
    this.collision.addBox(
      tx - 1.2, tz - 0.3, tx + 1.2, tz + 0.3,
      'tallShelf',
      { occludes: true },
    );
    this.tallShelf = tall;
  }

  buildWallProps() {
    this.quietSignData.push({ x: -10.83, y: 2, z: -5,   rotY: Math.PI / 2,  id: 'quietSign_w1' });
    this.quietSignData.push({ x: -10.83, y: 2, z:  3,   rotY: Math.PI / 2,  id: 'quietSign_w2' });
    this.quietSignData.push({ x:  10.83, y: 2, z: -8,   rotY: -Math.PI / 2, id: 'quietSign_e1' });
    this.quietSignData.push({ x:  0,     y: 2, z:  7.83, rotY: Math.PI,     id: 'quietSign_n1' });
  }

  buildDecor() {
    // Framed picture on west wall between perimeter shelf segments
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.7, 0.55),
      Mat.shelfWoodDark,
    );
    frame.position.set(-10.82, 2.4, 0);
    this.group.add(frame);
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.55, 0.4),
      Mat.paper,
    );
    paper.position.set(-10.79, 2.4, 0);
    this.group.add(paper);

    // Potted plant near the desk
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.35, 10),
      Mat.shelfWood,
    );
    pot.position.set(-9.5, 0.175, -14.5);
    this.group.add(pot);
    const plant = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      Mat.bush,
    );
    plant.scale.set(1, 1.2, 1);
    plant.position.set(-9.5, 0.55, -14.5);
    this.group.add(plant);
    this.collision.addBox(-9.8, -14.8, -9.2, -14.2, 'libPlant');

    // Coat rack near the door
    const rackPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8),
      Mat.shelfWoodDark,
    );
    rackPole.position.set(-2.5, 0.9, -15);
    this.group.add(rackPole);
    const rackBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10),
      Mat.shelfWoodDark,
    );
    rackBase.position.set(-2.5, 0.025, -15);
    this.group.add(rackBase);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6),
        Mat.shelfWoodDark,
      );
      arm.position.set(-2.5 + Math.cos(a) * 0.1, 1.75, -15 + Math.sin(a) * 0.1);
      arm.rotation.z = a === 0 || a === Math.PI ? 0 : Math.PI / 2;
      this.group.add(arm);
    }
    const coat = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.15),
      Mat.cardiganDark,
    );
    coat.position.set(-2.5, 1.35, -15 + 0.15);
    this.group.add(coat);
  }

  createChair() {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.06, 0.6),
      Mat.shelfWood,
    );
    seat.position.y = 0.45;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.06),
      Mat.shelfWood,
    );
    back.position.set(0, 0.75, -0.27);
    chair.add(back);
    for (const lx of [-0.25, 0.25]) {
      for (const lz of [-0.25, 0.25]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.45, 0.05),
          Mat.shelfWoodDark,
        );
        leg.position.set(lx, 0.225, lz);
        chair.add(leg);
      }
    }
    return chair;
  }

  createArmchair() {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.2, 0.8),
      Mat.cardigan,
    );
    seat.position.y = 0.4;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.0, 0.18),
      Mat.cardigan,
    );
    back.position.set(0, 0.9, -0.31);
    chair.add(back);
    for (const ax of [-0.35, 0.35]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.45, 0.7),
        Mat.cardigan,
      );
      arm.position.set(ax, 0.62, -0.05);
      chair.add(arm);
    }
    // Wooden base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.1, 0.8),
      Mat.shelfWoodDark,
    );
    base.position.y = 0.05;
    chair.add(base);
    return chair;
  }

  update(dt, elapsed) {
    for (const shelf of this.bookshelves) {
      shelf.update(dt);
    }
  }

  isInside(pos) {
    return pos.z > -15.7 && pos.z < 7.7
      && pos.x > -10.7 && pos.x < 10.7;
  }

  isOverWater() {
    return false;
  }
}

function makePattern(dominant) {
  const rows = 4;
  const cols = 10;
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const other = (r + c) % 5 === 0;
      row.push(other ? (dominant === 'r' ? 'b' : 'r') : dominant);
    }
    out.push(row);
  }
  return out;
}
