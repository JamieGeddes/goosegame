import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Villager {
  constructor(type, startPos) {
    this.type = type;
    this.group = new THREE.Group();
    this.group.name = `villager_${type}`;
    this.walkPhase = 0;
    this.isWalking = false;

    // Alert indicator
    this.alertMark = null;

    this.build(type);
    this.group.position.set(startPos.x, 0, startPos.z);
  }

  build(type) {
    const config = Villager.TYPES[type];

    // Body (cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8);
    const body = new THREE.Mesh(bodyGeo, config.bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    this.group.add(body);

    // Apron/accessory
    if (config.apronMat) {
      const apronGeo = new THREE.BoxGeometry(0.35, 0.4, 0.1);
      const apron = new THREE.Mesh(apronGeo, config.apronMat);
      apron.position.set(0, 0.7, 0.17);
      this.group.add(apron);
    }

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const head = new THREE.Mesh(headGeo, config.skinMat);
    head.position.y = 1.4;
    head.castShadow = true;
    this.group.add(head);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    for (const side of [-0.06, 0.06]) {
      const eye = new THREE.Mesh(eyeGeo, Mat.gooseEye);
      eye.position.set(side, 1.44, 0.15);
      this.group.add(eye);
    }

    // Hair
    if (config.hairMat) {
      const hairGeo = new THREE.SphereGeometry(0.19, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const hair = new THREE.Mesh(hairGeo, config.hairMat);
      hair.position.y = 1.4;
      this.group.add(hair);
    }

    // Hat
    if (config.hatMat) {
      if (type === 'gardener') {
        // Straw hat
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 10), config.hatMat);
        brim.position.y = 1.58;
        this.group.add(brim);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 8), config.hatMat);
        top.position.y = 1.63;
        this.group.add(top);
      } else if (type === 'boy') {
        // Baseball cap
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), config.hatMat);
        cap.position.y = 1.43;
        this.group.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.1), config.hatMat);
        visor.position.set(0, 1.52, 0.12);
        this.group.add(visor);
      }
    }

    // Arms
    this.armL = new THREE.Group();
    this.armL.position.set(-0.28, 1.1, 0);
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6);
    const armMeshL = new THREE.Mesh(armGeo, config.skinMat);
    armMeshL.position.y = -0.2;
    this.armL.add(armMeshL);
    this.group.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(0.28, 1.1, 0);
    const armMeshR = new THREE.Mesh(armGeo.clone(), config.skinMat);
    armMeshR.position.y = -0.2;
    this.armR.add(armMeshR);
    this.group.add(this.armR);

    // Legs
    this.legL = new THREE.Group();
    this.legL.position.set(-0.1, 0.4, 0);
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6);
    const legMeshL = new THREE.Mesh(legGeo, config.pantsMat);
    legMeshL.position.y = -0.2;
    this.legL.add(legMeshL);
    // Shoe
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.16);
    const shoeL = new THREE.Mesh(shoeGeo, Mat.shoe);
    shoeL.position.set(0, -0.4, 0.03);
    this.legL.add(shoeL);
    this.group.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.1, 0.4, 0);
    const legMeshR = new THREE.Mesh(legGeo.clone(), config.pantsMat);
    legMeshR.position.y = -0.2;
    this.legR.add(legMeshR);
    const shoeR = new THREE.Mesh(shoeGeo.clone(), Mat.shoe);
    shoeR.position.set(0, -0.4, 0.03);
    this.legR.add(shoeR);
    this.group.add(this.legR);

    // Scale boy smaller
    if (type === 'boy') {
      this.group.scale.set(0.7, 0.7, 0.7);
    }

    // Alert exclamation mark (hidden initially)
    this.alertMark = this.createAlertMark();
    this.alertMark.visible = false;
    this.group.add(this.alertMark);
  }

  createAlertMark() {
    const g = new THREE.Group();
    g.position.y = 2.0;

    const dotGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    g.add(dot);

    const stickGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04);
    const stick = new THREE.Mesh(stickGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    stick.position.y = 0.16;
    g.add(stick);

    return g;
  }

  update(dt) {
    if (this.isWalking) {
      this.walkPhase += dt * 5;
      const swing = Math.sin(this.walkPhase) * 0.3;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.5;
      this.armR.rotation.x = swing * 0.5;
    } else {
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      this.armL.rotation.x *= 0.9;
      this.armR.rotation.x *= 0.9;
    }

    // Alert mark billboard (always face camera) - handled by rotation
    if (this.alertMark.visible) {
      this.alertMark.position.y = 2.0 + Math.sin(Date.now() * 0.005) * 0.05;
    }
  }

  getPosition() {
    return this.group.position;
  }

  setAlert(on) {
    this.alertMark.visible = on;
  }
}

Villager.TYPES = {
  gardener: {
    bodyMat: Mat.shirtGreen,
    skinMat: Mat.skin,
    hairMat: Mat.hairBrown,
    hatMat: Mat.strawHat,
    pantsMat: Mat.pantsBrown,
    apronMat: null,
  },
  shopkeeper: {
    bodyMat: Mat.shirtBlue,
    skinMat: Mat.skin,
    hairMat: Mat.hairBrown,
    hatMat: null,
    pantsMat: Mat.pants,
    apronMat: Mat.apronBlue,
  },
  boy: {
    bodyMat: Mat.shirtRed,
    skinMat: Mat.skin,
    hairMat: Mat.hairBrown,
    hatMat: Mat.capRed,
    pantsMat: Mat.pants,
    apronMat: null,
  },
  oldLady: {
    bodyMat: Mat.dressPurple,
    skinMat: Mat.skinDark,
    hairMat: Mat.hairWhite,
    hatMat: null,
    pantsMat: Mat.dressPurple,
    apronMat: null,
  },
};
