import * as THREE from 'three';

const toonGradient = new THREE.DataTexture(
  new Uint8Array([80, 160, 255]),
  3, 1, THREE.RedFormat
);
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.needsUpdate = true;

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient });
}

export const Mat = {
  // Goose
  gooseWhite:   toon(0xf5f0e8),
  gooseBeak:    toon(0xf0c040),
  gooseEye:     toon(0x1a1a1a),
  gooseLeg:     toon(0xe87830),
  gooseHatGreen:toon(0x3a8a3a),
  gooseScarf:   toon(0x3a8a3a),

  // Nature
  grass:        toon(0x5dad3a),
  grassDark:    toon(0x4a9630),
  dirtPath:     toon(0xc4a56a),
  water:        new THREE.MeshToonMaterial({ color: 0x4a90c4, transparent: true, opacity: 0.7, gradientMap: toonGradient }),
  treeTrunk:    toon(0x8B5a2b),
  treeLeaf:     toon(0x3d8b37),
  treeLeafDark: toon(0x2d6b27),
  bush:         toon(0x4a9040),
  reed:         toon(0x6a9a40),
  lilypad:      toon(0x3a7a2a),
  flower:       toon(0xff6090),
  flowerYellow: toon(0xffd040),
  rock:         toon(0x888888),
  rockDark:     toon(0x666666),
  mud:          toon(0x8B6914),

  // Buildings
  wallWhite:    toon(0xf0ead8),
  wallCream:    toon(0xe8dcc0),
  wallStone:    toon(0xb0a890),
  roofRed:      toon(0xb84030),
  roofBrown:    toon(0x8B5a2b),
  roofGrey:     toon(0x707070),
  door:         toon(0x6a4a2a),
  windowBlue:   toon(0x87CEEB),
  windowFrame:  toon(0xf0e8d0),
  phoneRed:     toon(0xcc2020),
  awning:       toon(0xcc4444),
  awningStripe: toon(0xeeeeee),

  // Fences & props
  fence:        toon(0xa08050),
  bench:        toon(0x8B6240),
  metal:        toon(0x888898),
  metalDark:    toon(0x555565),
  signWood:     toon(0xa07040),
  binGreen:     toon(0x4a7a3a),

  // Villagers
  skin:         toon(0xf0c8a0),
  skinDark:     toon(0xd4a878),
  shirtGreen:   toon(0x4a8a3a),
  shirtBlue:    toon(0x4060b0),
  shirtRed:     toon(0xc83030),
  apronBlue:    toon(0x5070c0),
  dressPurple:  toon(0x7050a0),
  hairBrown:    toon(0x5a3820),
  hairWhite:    toon(0xe0dcd0),
  strawHat:     toon(0xd4b870),
  capRed:       toon(0xc83030),
  pants:        toon(0x404050),
  pantsBrown:   toon(0x6a5030),
  shoe:         toon(0x3a2a1a),

  // Objects
  objectWood:   toon(0x9a7040),
  objectMetal:  toon(0x7a7a8a),
  objectRed:    toon(0xc04040),
  pumpkinOrange:toon(0xe87830),
  appleRed:     toon(0xcc2020),
  appleGreen:   toon(0x60a030),
  breadTan:     toon(0xd4a060),
  glassLens:    new THREE.MeshToonMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5, gradientMap: toonGradient }),
  lampGlow:     new THREE.MeshBasicMaterial({ color: 0xfff0c0 }),
  bellGold:     toon(0xd4a020),
  vegGreen:     toon(0x4a8a2a),
  vegOrange:    toon(0xe07020),
};
