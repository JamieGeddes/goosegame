import * as THREE from 'three';

export function createWebbedFoot(material) {
  const group = new THREE.Group();

  const toeGeo = new THREE.BoxGeometry(0.06, 0.02, 0.18);
  for (let i = -1; i <= 1; i++) {
    const toe = new THREE.Mesh(toeGeo, material);
    toe.position.set(i * 0.06, 0, 0.06);
    toe.rotation.y = i * 0.2;
    group.add(toe);
  }

  // Webbing between toes
  const webGeo = new THREE.PlaneGeometry(0.2, 0.16);
  const web = new THREE.Mesh(webGeo, material);
  web.rotation.x = -Math.PI / 2;
  web.position.set(0, 0.005, 0.05);
  group.add(web);

  return group;
}

export function createEggShape(radiusX, radiusY, radiusZ, segments = 16) {
  const geo = new THREE.SphereGeometry(1, segments, segments);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Scale and make top narrower for egg shape
    const topFactor = y > 0 ? 1 - y * 0.2 : 1;
    pos.setXYZ(i, x * radiusX * topFactor, y * radiusY, z * radiusZ * topFactor);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRoundedBox(w, h, d, r, material) {
  // Approximate rounded box with a regular box for simplicity
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, material);
}

export function createCompositeShape(parts) {
  const group = new THREE.Group();
  parts.forEach(({ geo, mat, pos, rot, scale }) => {
    const mesh = new THREE.Mesh(geo, mat);
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}
