import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Buildings {
  constructor(collisionManager) {
    this.group = new THREE.Group();
    this.collision = collisionManager;
    this.build();
  }

  build() {
    this.buildHouse1(-10, -15, 0);
    this.buildHouse2(10, -18, Math.PI * 0.1);
    this.buildShop(-15, 5, Math.PI / 2);
    this.buildPhoneBooth(5, 2, 0);
    this.buildPub(14, 8, -Math.PI / 2);
  }

  buildHouse1(x, z, rot) {
    const house = new THREE.Group();

    // Walls
    const wallGeo = new THREE.BoxGeometry(5, 3, 4);
    const walls = new THREE.Mesh(wallGeo, Mat.wallWhite);
    walls.position.y = 1.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    // Roof
    const roofGeo = new THREE.ConeGeometry(3.8, 2, 4);
    const roof = new THREE.Mesh(roofGeo, Mat.roofRed);
    roof.position.y = 4;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);

    // Door
    const doorGeo = new THREE.BoxGeometry(0.8, 1.6, 0.1);
    const door = new THREE.Mesh(doorGeo, Mat.door);
    door.position.set(0, 0.8, 2.05);
    house.add(door);

    // Windows
    this.addWindow(house, -1.5, 1.8, 2.05);
    this.addWindow(house, 1.5, 1.8, 2.05);

    house.position.set(x, 0, z);
    house.rotation.y = rot;
    this.group.add(house);
    this.collision.addBox(x - 2.8, z - 2.3, x + 2.8, z + 2.3, 'house1');
  }

  buildHouse2(x, z, rot) {
    const house = new THREE.Group();

    const wallGeo = new THREE.BoxGeometry(4.5, 3.5, 4.5);
    const walls = new THREE.Mesh(wallGeo, Mat.wallCream);
    walls.position.y = 1.75;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    const roofGeo = new THREE.ConeGeometry(3.5, 2.2, 4);
    const roof = new THREE.Mesh(roofGeo, Mat.roofBrown);
    roof.position.y = 4.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);

    const doorGeo = new THREE.BoxGeometry(0.8, 1.6, 0.1);
    const door = new THREE.Mesh(doorGeo, Mat.door);
    door.position.set(0, 0.8, 2.3);
    house.add(door);

    this.addWindow(house, -1.2, 2.0, 2.3);
    this.addWindow(house, 1.2, 2.0, 2.3);

    house.position.set(x, 0, z);
    house.rotation.y = rot;
    this.group.add(house);
    this.collision.addBox(x - 2.6, z - 2.8, x + 2.6, z + 2.8, 'house2');
  }

  buildShop(x, z, rot) {
    const shop = new THREE.Group();

    const wallGeo = new THREE.BoxGeometry(6, 3, 4);
    const walls = new THREE.Mesh(wallGeo, Mat.wallStone);
    walls.position.y = 1.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    shop.add(walls);

    const roofGeo = new THREE.BoxGeometry(6.5, 0.3, 4.5);
    const roof = new THREE.Mesh(roofGeo, Mat.roofGrey);
    roof.position.y = 3.15;
    roof.castShadow = true;
    shop.add(roof);

    // Awning
    const awningGeo = new THREE.BoxGeometry(4, 0.1, 1.5);
    const awning = new THREE.Mesh(awningGeo, Mat.awning);
    awning.position.set(0, 2.5, 2.7);
    awning.rotation.x = 0.15;
    shop.add(awning);

    // Awning stripes
    for (let i = -1.5; i <= 1.5; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.12, 1.5),
        Mat.awningStripe
      );
      stripe.position.set(i, 2.5, 2.7);
      stripe.rotation.x = 0.15;
      shop.add(stripe);
    }

    // Large front window
    const winGeo = new THREE.BoxGeometry(2.5, 1.5, 0.1);
    const win = new THREE.Mesh(winGeo, Mat.windowBlue);
    win.position.set(0, 1.6, 2.05);
    shop.add(win);

    const doorGeo = new THREE.BoxGeometry(1, 1.8, 0.1);
    const door = new THREE.Mesh(doorGeo, Mat.door);
    door.position.set(-2, 0.9, 2.05);
    shop.add(door);

    shop.position.set(x, 0, z);
    shop.rotation.y = rot;
    this.group.add(shop);
    this.collision.addBox(x - 2.3, z - 3.3, x + 2.3, z + 3.3, 'shop');
  }

  buildPhoneBooth(x, z, rot) {
    const booth = new THREE.Group();
    booth.name = 'phoneBooth';

    const wallsGeo = new THREE.BoxGeometry(1, 2.5, 1);
    const walls = new THREE.Mesh(wallsGeo, Mat.phoneRed);
    walls.position.y = 1.25;
    walls.castShadow = true;
    booth.add(walls);

    // Glass panels
    const glassGeo = new THREE.BoxGeometry(0.05, 1.5, 0.7);
    const glassMat = new THREE.MeshToonMaterial({ color: 0xaaddee, transparent: true, opacity: 0.3 });
    for (const side of [-0.5, 0.5]) {
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(side, 1.5, 0);
      booth.add(glass);
    }

    const roofGeo = new THREE.BoxGeometry(1.1, 0.15, 1.1);
    const roof = new THREE.Mesh(roofGeo, Mat.phoneRed);
    roof.position.y = 2.55;
    booth.add(roof);

    // Door frame
    this.phoneBoothDoor = new THREE.Group();
    this.phoneBoothDoor.position.set(-0.5, 0, 0.5);
    const doorGeo = new THREE.BoxGeometry(0.05, 2.2, 0.9);
    const door = new THREE.Mesh(doorGeo, Mat.phoneRed);
    door.position.set(0.025, 1.1, -0.05);
    this.phoneBoothDoor.add(door);
    booth.add(this.phoneBoothDoor);

    booth.position.set(x, 0, z);
    booth.rotation.y = rot;
    this.group.add(booth);
    this.collision.addBox(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 'phoneBooth');
  }

  buildPub(x, z, rot) {
    const pub = new THREE.Group();

    // Main building - two story
    const wallGeo = new THREE.BoxGeometry(7, 5, 5);
    const walls = new THREE.Mesh(wallGeo, Mat.wallStone);
    walls.position.y = 2.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    pub.add(walls);

    const roofGeo = new THREE.ConeGeometry(5.2, 2, 4);
    const roof = new THREE.Mesh(roofGeo, Mat.roofBrown);
    roof.position.y = 6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    pub.add(roof);

    // Ground floor windows
    this.addWindow(pub, -2, 1.5, 2.55);
    this.addWindow(pub, 2, 1.5, 2.55);

    // Upper windows
    this.addWindow(pub, -2, 3.8, 2.55);
    this.addWindow(pub, 0, 3.8, 2.55);
    this.addWindow(pub, 2, 3.8, 2.55);

    // Door
    const doorGeo = new THREE.BoxGeometry(1.2, 2, 0.1);
    const door = new THREE.Mesh(doorGeo, Mat.door);
    door.position.set(0, 1, 2.55);
    pub.add(door);

    // Sign
    const signGeo = new THREE.BoxGeometry(2, 0.6, 0.1);
    const sign = new THREE.Mesh(signGeo, Mat.signWood);
    sign.position.set(0, 3, 2.6);
    pub.add(sign);

    // Outdoor table
    const tableGeo = new THREE.BoxGeometry(1.5, 0.08, 1);
    const table = new THREE.Mesh(tableGeo, Mat.objectWood);
    table.position.set(-2, 0.7, 4);
    table.castShadow = true;
    pub.add(table);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6);
    for (const lx of [-0.6, 0.6]) {
      for (const lz of [-0.4, 0.4]) {
        const leg = new THREE.Mesh(legGeo, Mat.objectWood);
        leg.position.set(-2 + lx, 0.35, 4 + lz);
        pub.add(leg);
      }
    }

    pub.position.set(x, 0, z);
    pub.rotation.y = rot;
    this.group.add(pub);
    this.collision.addBox(x - 2.8, z - 3.8, x + 2.8, z + 3.8, 'pub');
  }

  addWindow(parent, x, y, z) {
    const frameGeo = new THREE.BoxGeometry(0.9, 0.9, 0.1);
    const frame = new THREE.Mesh(frameGeo, Mat.windowFrame);
    frame.position.set(x, y, z);
    parent.add(frame);

    const glassGeo = new THREE.BoxGeometry(0.7, 0.7, 0.12);
    const glass = new THREE.Mesh(glassGeo, Mat.windowBlue);
    glass.position.set(x, y, z);
    parent.add(glass);

    // Cross bar
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.13), Mat.windowFrame);
    barH.position.set(x, y, z);
    parent.add(barH);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.13), Mat.windowFrame);
    barV.position.set(x, y, z);
    parent.add(barV);
  }
}
