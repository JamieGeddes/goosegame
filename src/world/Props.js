import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Props {
  constructor(collisionManager) {
    this.group = new THREE.Group();
    this.collision = collisionManager;
    this.build();
  }

  build() {
    // Benches
    this.addBench(2, -5, 0);
    this.addBench(-5, 0, Math.PI / 2);
    this.addBench(8, 5, -0.3);

    // Lampposts
    this.addLamppost(-3, -8);
    this.addLamppost(3, 5);
    this.addLamppost(-6, 15);
    this.addLamppost(10, -3);

    // Bins
    this.addBin(0, -3);
    this.addBin(6, 0);

    // Signs
    this.addSign(-2, -12, 'Village\nSquare');
    this.addSign(8, -3, 'Garden →');

    // Market stall
    this.buildMarketStall(3, -10);

    // Well/fountain in village square
    this.buildFountain(0, -6);
  }

  addBench(x, z, rot = 0) {
    const bench = new THREE.Group();

    // Seat
    const seatGeo = new THREE.BoxGeometry(1.5, 0.06, 0.5);
    const seat = new THREE.Mesh(seatGeo, Mat.bench);
    seat.position.y = 0.45;
    seat.castShadow = true;
    bench.add(seat);

    // Back
    const backGeo = new THREE.BoxGeometry(1.5, 0.5, 0.06);
    const back = new THREE.Mesh(backGeo, Mat.bench);
    back.position.set(0, 0.7, -0.22);
    back.castShadow = true;
    bench.add(back);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.4);
    for (const lx of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(legGeo, Mat.metalDark);
      leg.position.set(lx, 0.225, 0);
      bench.add(leg);
    }

    bench.position.set(x, 0, z);
    bench.rotation.y = rot;
    this.group.add(bench);
    this.collision.addBox(x - 0.8, z - 0.4, x + 0.8, z + 0.4, 'bench');
  }

  addLamppost(x, z) {
    const lamp = new THREE.Group();

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.06, 3, 8);
    const pole = new THREE.Mesh(poleGeo, Mat.metalDark);
    pole.position.y = 1.5;
    pole.castShadow = true;
    lamp.add(pole);

    // Base
    const baseGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.15, 8);
    const base = new THREE.Mesh(baseGeo, Mat.metalDark);
    base.position.y = 0.075;
    lamp.add(base);

    // Arm
    const armGeo = new THREE.BoxGeometry(0.6, 0.04, 0.04);
    const arm = new THREE.Mesh(armGeo, Mat.metalDark);
    arm.position.set(0.25, 2.9, 0);
    lamp.add(arm);

    // Light
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const light = new THREE.Mesh(lightGeo, Mat.lampGlow);
    light.position.set(0.5, 2.8, 0);
    lamp.add(light);

    // Point light
    const pointLight = new THREE.PointLight(0xfff0c0, 0.5, 6);
    pointLight.position.set(0.5, 2.8, 0);
    lamp.add(pointLight);

    lamp.position.set(x, 0, z);
    this.group.add(lamp);
    this.collision.addBox(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 'lamppost');
  }

  addBin(x, z) {
    const bin = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.7, 8);
    const body = new THREE.Mesh(bodyGeo, Mat.binGreen);
    body.position.y = 0.35;
    body.castShadow = true;
    bin.add(body);

    const lidGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.05, 8);
    const lid = new THREE.Mesh(lidGeo, Mat.binGreen);
    lid.position.y = 0.72;
    bin.add(lid);

    bin.position.set(x, 0, z);
    this.group.add(bin);
  }

  addSign(x, z, text) {
    const sign = new THREE.Group();

    const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6);
    const post = new THREE.Mesh(postGeo, Mat.signWood);
    post.position.y = 0.75;
    sign.add(post);

    const boardGeo = new THREE.BoxGeometry(1, 0.5, 0.06);
    const board = new THREE.Mesh(boardGeo, Mat.signWood);
    board.position.y = 1.3;
    board.castShadow = true;
    sign.add(board);

    sign.position.set(x, 0, z);
    this.group.add(sign);
  }

  buildMarketStall(x, z) {
    const stall = new THREE.Group();

    // Counter
    const counterGeo = new THREE.BoxGeometry(3, 0.8, 1.2);
    const counter = new THREE.Mesh(counterGeo, Mat.objectWood);
    counter.position.y = 0.4;
    counter.castShadow = true;
    stall.add(counter);

    // Canopy poles
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 6);
    for (const px of [-1.3, 1.3]) {
      for (const pz of [-0.5, 0.5]) {
        const pole = new THREE.Mesh(poleGeo, Mat.objectWood);
        pole.position.set(px, 1, pz);
        stall.add(pole);
      }
    }

    // Canopy
    const canopyGeo = new THREE.BoxGeometry(3.2, 0.05, 1.5);
    const canopy = new THREE.Mesh(canopyGeo, Mat.awning);
    canopy.position.y = 2;
    canopy.rotation.x = 0.1;
    stall.add(canopy);

    // Items on counter (decorative)
    for (let i = 0; i < 4; i++) {
      const itemGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3);
      const item = new THREE.Mesh(itemGeo, [Mat.appleRed, Mat.pumpkinOrange, Mat.breadTan, Mat.vegGreen][i]);
      item.position.set(-1 + i * 0.7, 0.9, 0);
      stall.add(item);
    }

    stall.position.set(x, 0, z);
    this.group.add(stall);
    this.collision.addBox(x - 1.7, z - 0.8, x + 1.7, z + 0.8, 'marketStall');
  }

  buildFountain(x, z) {
    const fountain = new THREE.Group();

    // Base
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 12);
    const base = new THREE.Mesh(baseGeo, Mat.wallStone);
    base.position.y = 0.2;
    base.castShadow = true;
    fountain.add(base);

    // Water
    const waterGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.1, 12);
    const water = new THREE.Mesh(waterGeo, Mat.water);
    water.position.y = 0.35;
    fountain.add(water);

    // Center pillar
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
    const pillar = new THREE.Mesh(pillarGeo, Mat.wallStone);
    pillar.position.y = 0.6;
    pillar.castShadow = true;
    fountain.add(pillar);

    // Top basin
    const topGeo = new THREE.CylinderGeometry(0.5, 0.3, 0.15, 10);
    const top = new THREE.Mesh(topGeo, Mat.wallStone);
    top.position.y = 1.2;
    fountain.add(top);

    fountain.position.set(x, 0, z);
    this.group.add(fountain);
    this.collision.addBox(x - 1.3, z - 1.3, x + 1.3, z + 1.3, 'fountain');
  }
}
