import * as THREE from 'three';
import { Target } from '../entities/Target';

export class CombatSystem {
  private raycaster = new THREE.Raycaster();

  public checkHit(camera: THREE.Camera, targets: Target[]): Target | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    const targetMeshes = targets.map(t => t.mesh);
    const intersects = this.raycaster.intersectObjects(targetMeshes, true);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      
      let current: THREE.Object3D | null = hitObject;
      while (current) {
        if (current.userData.entity instanceof Target) {
          return current.userData.entity;
        }
        current = current.parent;
      }
    }
    return null;
  }
}
