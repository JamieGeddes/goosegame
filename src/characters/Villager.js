import * as THREE from 'three';
import { Mat } from '../utils/Materials.js';

export class Villager {
  constructor(type, startPos, overrides = {}) {
    this.type = type;
    this.overrides = overrides;
    this.group = new THREE.Group();
    this.group.name = `villager_${type}`;
    this.walkPhase = 0;
    this.isWalking = false;

    // Alert indicator
    this.alertMark = null;

    // A1: Flinch state
    this.flinchAmount = 0;
    this.flinchTimer = 0;
    this.isFlinching = false;

    // B1: Idle activity
    this.currentIdleActivity = null;
    this.idleAnimTimer = 0;

    // B3: Frustration
    this.frustrationLevel = 0;
    this.fistShakeTimer = 0;
    this.isFistShaking = false;

    // Fire-alarm panic
    this.isPanicking = false;
    this.panicTimer = 0;

    // D3: Head scanning
    this.headScanTarget = 0;
    this.headScanCurrent = 0;

    // G4: Speech bubble
    this.speechBubble = null;
    this.currentBubbleType = null;

    this.build(type);
    this.group.position.set(startPos.x, 0, startPos.z);
  }

  build(type) {
    const baseConfig = Villager.TYPES[type];
    const config = { ...baseConfig, ...this.overrides };

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
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.4;
    this.group.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const head = new THREE.Mesh(headGeo, config.skinMat);
    head.castShadow = true;
    this.headGroup.add(head);

    // Eyes — positioned below the hairline (y < 0 in local head frame) so the
    // hair hemisphere doesn't cover them when the head tilts forward.
    const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    for (const side of [-0.06, 0.06]) {
      const eye = new THREE.Mesh(eyeGeo, Mat.gooseEye);
      eye.position.set(side, -0.02, 0.165);
      this.headGroup.add(eye);
    }

    // Eyebrows — sit just above the eyes, still below the hairline
    const browGeo = new THREE.BoxGeometry(0.055, 0.015, 0.02);
    for (const side of [-0.06, 0.06]) {
      const brow = new THREE.Mesh(browGeo, Mat.gooseEye);
      brow.position.set(side, 0.02, 0.16);
      this.headGroup.add(brow);
    }

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const nose = new THREE.Mesh(noseGeo, config.skinMat);
    nose.position.set(0, -0.06, 0.175);
    this.headGroup.add(nose);

    // Mouth
    const mouthGeo = new THREE.BoxGeometry(0.06, 0.015, 0.02);
    const mouth = new THREE.Mesh(mouthGeo, Mat.mouth);
    mouth.position.set(0, -0.11, 0.155);
    this.headGroup.add(mouth);

    // Hair
    if (config.hairMat) {
      const hairGeo = new THREE.SphereGeometry(0.19, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const hair = new THREE.Mesh(hairGeo, config.hairMat);
      this.headGroup.add(hair);
    }

    // Hat
    if (config.hatMat) {
      if (type === 'gardener') {
        // Straw hat
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 10), config.hatMat);
        brim.position.y = 0.18;
        this.headGroup.add(brim);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.1, 8), config.hatMat);
        top.position.y = 0.23;
        this.headGroup.add(top);
      } else if (type === 'boy') {
        // Baseball cap
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), config.hatMat);
        cap.position.y = 0.03;
        this.headGroup.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.1), config.hatMat);
        visor.position.set(0, 0.12, 0.12);
        this.headGroup.add(visor);
      }
    }

    // Librarian: hair bun + half-moon glasses
    if (type === 'librarian') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), config.hairMat);
      bun.position.set(0, 0.05, -0.16);
      this.headGroup.add(bun);
      // Half-moon glasses perched on nose
      const glassesGroup = new THREE.Group();
      glassesGroup.position.set(0, -0.04, 0.17);
      for (const side of [-0.06, 0.06]) {
        const lens = new THREE.Mesh(
          new THREE.TorusGeometry(0.035, 0.006, 4, 12, Math.PI),
          Mat.objectMetal,
        );
        lens.position.set(side, 0, 0);
        lens.rotation.z = Math.PI; // half visible on underside for half-moon look
        glassesGroup.add(lens);
      }
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.006, 0.006),
        Mat.objectMetal,
      );
      glassesGroup.add(bridge);
      this.headGroup.add(glassesGroup);
      this.librarianGlasses = glassesGroup; // visible only until stolen
    }

    // Reader: book held in lap
    if (type === 'reader') {
      const bookGroup = new THREE.Group();
      bookGroup.position.set(0, 0.95, 0.25);
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.04, 0.2),
        config.bookMat || Mat.bookBrown,
      );
      bookGroup.add(cover);
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.02, 0.18),
        Mat.paper,
      );
      pages.position.y = 0.03;
      bookGroup.add(pages);
      bookGroup.rotation.x = -0.3;
      this.group.add(bookGroup);
      this.lapBook = bookGroup;
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

    // G4: Speech bubble (replaces old alert mark)
    this.speechBubble = this.createSpeechBubble();
    this.speechBubble.visible = false;
    this.group.add(this.speechBubble);

    // Keep alertMark reference for compatibility
    this.alertMark = this.speechBubble;
  }

  // G4: Speech bubble using CanvasTexture
  createSpeechBubble() {
    const g = new THREE.Group();
    g.position.y = 2.0;

    // Create canvas for bubble text
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    this.bubbleCanvas = canvas;
    this.bubbleCtx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.bubbleTexture = texture;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.6, 0.6, 1);
    g.add(sprite);
    this.bubbleSprite = sprite;

    return g;
  }

  drawBubble(text, bgColor, textColor) {
    const ctx = this.bubbleCtx;
    ctx.clearRect(0, 0, 64, 64);

    // Background circle
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.ellipse(32, 28, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small triangle pointer at bottom
    ctx.beginPath();
    ctx.moveTo(26, 46);
    ctx.lineTo(32, 56);
    ctx.lineTo(38, 46);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(32, 28, 26, 22, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 28);

    this.bubbleTexture.needsUpdate = true;
  }

  drawStormCloud() {
    const ctx = this.bubbleCtx;
    ctx.clearRect(0, 0, 64, 64);

    // Dark cloud shape
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(24, 28, 14, 0, Math.PI * 2);
    ctx.arc(38, 24, 12, 0, Math.PI * 2);
    ctx.arc(32, 34, 10, 0, Math.PI * 2);
    ctx.fill();

    // Lightning bolt
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(30, 36);
    ctx.lineTo(34, 44);
    ctx.lineTo(31, 44);
    ctx.lineTo(35, 54);
    ctx.lineTo(29, 46);
    ctx.lineTo(32, 46);
    ctx.lineTo(28, 36);
    ctx.fill();

    this.bubbleTexture.needsUpdate = true;
  }

  // G4: Set current bubble type
  setBubble(type) {
    if (type === this.currentBubbleType) return;
    this.currentBubbleType = type;

    if (!type) {
      this.speechBubble.visible = false;
      return;
    }

    this.speechBubble.visible = true;
    switch (type) {
      case 'alert':
        this.drawBubble('!', '#ffffff', '#333333');
        break;
      case 'chase':
        this.drawBubble('!!', '#ff4444', '#ffffff');
        break;
      case 'giveUp':
        this.drawBubble('...', '#aaaaaa', '#555555');
        break;
      case 'searching':
        this.drawBubble('?', '#ffdd44', '#555555');
        break;
      case 'startled':
        this.drawBubble('!', '#ff8800', '#ffffff');
        break;
      case 'frustrated':
        this.drawStormCloud();
        break;
    }
  }

  update(dt) {
    if (this.isWalking) {
      this.walkPhase += dt * 5;
      const swing = Math.sin(this.walkPhase) * 0.3;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      if (!this.isPanicking) {
        this.armL.rotation.x = -swing * 0.5;
        this.armR.rotation.x = swing * 0.5;
      }
    } else {
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      // Only lerp arms back if not flinching, shaking fist, or panicking
      if (!this.isFlinching && !this.isFistShaking && !this.isPanicking) {
        this.armL.rotation.x *= 0.9;
        this.armR.rotation.x *= 0.9;
      }
    }

    // A1: Flinch animation (arms raise)
    if (this.isFlinching) {
      this.flinchTimer += dt;
      const t = Math.min(this.flinchTimer / 0.5, 1);
      if (t < 0.3) {
        // Arms fly up
        const up = t / 0.3;
        this.armL.rotation.x = -up * 1.5;
        this.armR.rotation.x = -up * 1.5;
        this.armL.rotation.z = up * 0.5;
        this.armR.rotation.z = -up * 0.5;
      } else {
        // Arms come back down
        const down = (t - 0.3) / 0.7;
        this.armL.rotation.x = -1.5 * (1 - down);
        this.armR.rotation.x = -1.5 * (1 - down);
        this.armL.rotation.z = 0.5 * (1 - down);
        this.armR.rotation.z = -0.5 * (1 - down);
      }
      if (t >= 1) {
        this.isFlinching = false;
        this.armL.rotation.z = 0;
        this.armR.rotation.z = 0;
      }
    }

    // B3: Fist shake animation
    if (this.isFistShaking) {
      this.fistShakeTimer += dt;
      const t = this.fistShakeTimer;
      if (t < 1.0) {
        this.armR.rotation.x = -2.0 + Math.sin(t * 15) * 0.3;
        this.armR.rotation.z = -0.3;
      } else {
        this.isFistShaking = false;
        this.armR.rotation.x = 0;
        this.armR.rotation.z = 0;
      }
    }

    // Fire-alarm panic: arms held high, flailing side-to-side
    if (this.isPanicking) {
      this.panicTimer += dt;
      const t = this.panicTimer;
      this.armL.rotation.x = -2.6 + Math.sin(t * 14) * 0.25;
      this.armR.rotation.x = -2.6 + Math.sin(t * 13 + 1.3) * 0.25;
      this.armL.rotation.z =  0.4 + Math.sin(t * 11) * 0.5;
      this.armR.rotation.z = -0.4 + Math.sin(t * 12 + 0.7) * 0.5;
    }

    // B1: Idle activity animations
    if (this.currentIdleActivity) {
      this.idleAnimTimer += dt;
      this.animateIdleActivity();
    }

    // D3: Head scanning
    this.headScanCurrent += (this.headScanTarget - this.headScanCurrent) * Math.min(1, dt * 5);
    this.headGroup.rotation.y = this.headScanCurrent * 0.6;

    // Speech bubble bob
    if (this.speechBubble.visible) {
      this.speechBubble.position.y = 2.0 + Math.sin(Date.now() * 0.005) * 0.05;
    }
  }

  // B1: Idle activity animations
  animateIdleActivity() {
    const t = this.idleAnimTimer;
    switch (this.currentIdleActivity) {
      case 'tend_vegetables':
        // Bend down repeatedly
        this.group.children[0].position.y = 0.8 - Math.abs(Math.sin(t * 2)) * 0.15;
        this.armL.rotation.x = -0.8 + Math.sin(t * 3) * 0.2;
        this.armR.rotation.x = -0.8 + Math.sin(t * 3 + 1) * 0.2;
        break;
      case 'wipe_brow':
        this.armR.rotation.x = -2.2;
        this.armR.rotation.z = Math.sin(t * 4) * 0.2;
        break;
      case 'sweep':
        this.armL.rotation.x = -0.5 + Math.sin(t * 3) * 0.3;
        this.armR.rotation.x = -0.5 + Math.sin(t * 3) * 0.3;
        this.group.rotation.y += Math.sin(t * 3) * 0.02;
        break;
      case 'rearrange':
        this.armR.rotation.x = -0.8;
        this.armR.rotation.z = Math.sin(t * 2) * 0.3;
        break;
      case 'sit':
        // Lower position slightly
        this.legL.rotation.x = -1.2;
        this.legR.rotation.x = -1.2;
        break;
      case 'kick_ground':
        this.legR.rotation.x = Math.sin(t * 4) * 0.5;
        break;
      case 'read':
        this.armL.rotation.x = -1.0;
        this.armR.rotation.x = -1.0;
        this.headGroup.rotation.x = -0.15;
        break;
      case 'feed_ducks':
        this.armR.rotation.x = -0.6 + Math.sin(t * 2) * 0.3;
        break;
      case 'shelving_books':
        // Reach up-and-forward, slide a book in, repeat
        this.armR.rotation.x = -1.3 + Math.sin(t * 2.5) * 0.35;
        this.armL.rotation.x = -0.5;
        break;
      case 'stamping':
        // Right arm hammers down on desk rhythmically
        this.armR.rotation.x = -0.6 - Math.max(0, Math.sin(t * 4)) * 0.7;
        this.armL.rotation.x = -0.3;
        break;
      case 'hushing':
        // Finger to lips pose (right arm up near face)
        this.armR.rotation.x = -2.6;
        this.armR.rotation.z = -0.2;
        this.armL.rotation.x = -0.2;
        break;
      case 'reading_book':
        // Seated reader: arms cradling a book in lap, head tilted down
        this.armL.rotation.x = -1.2;
        this.armR.rotation.x = -1.2;
        this.armL.rotation.z = 0.2;
        this.armR.rotation.z = -0.2;
        this.legL.rotation.x = -1.4;
        this.legR.rotation.x = -1.4;
        this.headGroup.rotation.x = -0.3;
        // Subtle page-flip motion
        if (this.lapBook) this.lapBook.rotation.y = Math.sin(t * 0.8) * 0.1;
        break;
    }
  }

  startIdleActivity(activity) {
    this.currentIdleActivity = activity;
    this.idleAnimTimer = 0;
  }

  stopIdleActivity() {
    if (!this.currentIdleActivity) return;
    // Reset body parts to neutral
    this.group.children[0].position.y = 0.8;
    this.legL.rotation.x = 0;
    this.legR.rotation.x = 0;
    this.armL.rotation.x = 0;
    this.armR.rotation.x = 0;
    this.armL.rotation.z = 0;
    this.armR.rotation.z = 0;
    this.headGroup.rotation.x = 0;
    this.currentIdleActivity = null;
  }

  // A1: Trigger flinch
  flinch() {
    this.isFlinching = true;
    this.flinchTimer = 0;
  }

  setFlinch(amount) {
    this.flinchAmount = amount;
  }

  // B3: Trigger fist shake at sky
  fistShake() {
    this.isFistShaking = true;
    this.fistShakeTimer = 0;
    this.setBubble('frustrated');
  }

  panic() {
    this.isPanicking = true;
    this.panicTimer = 0;
  }

  stopPanic() {
    this.isPanicking = false;
    this.armL.rotation.z = 0;
    this.armR.rotation.z = 0;
  }

  // B3: Update frustration visuals
  setFrustration(level) {
    this.frustrationLevel = level;
    // At level 3, change alert mark color (handled by speech bubble)
  }

  // D3: Set head scan direction
  setHeadScan(direction) {
    this.headScanTarget = direction;
  }

  getPosition() {
    return this.group.position;
  }

  setAlert(on) {
    // Handled by setBubble now, but keep for backward compatibility
    if (!on && !this.currentBubbleType) {
      this.speechBubble.visible = false;
    }
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
  librarian: {
    bodyMat: Mat.cardigan,
    skinMat: Mat.skin,
    hairMat: Mat.hairWhite,
    hatMat: null,
    pantsMat: Mat.cardiganDark,
    apronMat: Mat.cardiganDark,
  },
  reader: {
    bodyMat: Mat.shirtBlue,
    skinMat: Mat.skin,
    hairMat: Mat.hairBrown,
    hatMat: null,
    pantsMat: Mat.pants,
    apronMat: null,
    bookMat: Mat.bookBrown,
  },
};
