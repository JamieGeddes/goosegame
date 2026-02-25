import * as THREE from 'three';

export class InteractableObject {
  constructor(mesh, name, interactRadius = 1.5) {
    this.mesh = mesh;
    this.name = name;
    this.interactRadius = interactRadius;
    this.isHighlighted = false;
    this.isActive = true;
    this.originalMaterials = new Map();

    // Store original materials for highlight toggling
    mesh.traverse((child) => {
      if (child.isMesh) {
        this.originalMaterials.set(child, child.material);
      }
    });
  }

  getWorldPosition() {
    const pos = new THREE.Vector3();
    this.mesh.getWorldPosition(pos);
    return pos;
  }

  setHighlight(on) {
    if (this.isHighlighted === on) return;
    this.isHighlighted = on;

    this.mesh.traverse((child) => {
      if (child.isMesh) {
        if (on) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color(0x444400);
          child.material.emissiveIntensity = 0.3;
        } else {
          const orig = this.originalMaterials.get(child);
          if (orig) child.material = orig;
        }
      }
    });
  }

  interact(gameState) {
    // Override in subclasses
  }
}
