import { Scene, Ray, Vector3, Mesh } from '@babylonjs/core';

export interface HitScanResult {
  hit: boolean;
  pickedMesh?: Mesh;
  pickedPoint?: Vector3;
  normal?: Vector3;
}

export class HitScanSystem {
  /**
   * 클라이언트와 서버에서 공통으로 사용할 수 있는 레이캐스트 판정 함수
   */
  public static doRaycast(
    scene: Scene,
    origin: Vector3,
    direction: Vector3,
    range: number,
    predicate?: (mesh: Mesh) => boolean
  ): HitScanResult {
    const ray = new Ray(origin, direction, range);

    const pickInfo = scene.pickWithRay(ray, (mesh) => {
      // 기본 필터: 피격 가능한 메쉬만
      if (!mesh.isPickable || !mesh.isVisible) return false;

      if (predicate) {
        return predicate(mesh as Mesh);
      }
      return true;
    });

    if (pickInfo?.hit && pickInfo.pickedMesh) {
      return {
        hit: true,
        pickedMesh: pickInfo.pickedMesh as Mesh,
        pickedPoint: pickInfo.pickedPoint || undefined,
        normal: pickInfo.getNormal(true) || undefined,
      };
    }

    return { hit: false };
  }
}
