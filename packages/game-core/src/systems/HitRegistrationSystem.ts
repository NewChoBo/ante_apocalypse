import { Scene, Vector3, AbstractMesh } from '@babylonjs/core';
import { HitScanSystem } from './HitScanSystem.js';

export interface HitValidationResult {
  isValid: boolean;
  part: string;
  method: 'strict' | 'lenient' | 'none';
  distance?: number;
}

/**
 * 히트 판정 검증 시스템 (서버 권위 판정 및 공통 판정 로직)
 */
export class HitRegistrationSystem {
  /**
   * 레이캐스트와 거리 기반 검증을 결합하여 히트 여부를 판정합니다.
   */
  public static validateHit(
    scene: Scene,
    targetId: string,
    origin: Vector3,
    direction: Vector3,
    targetMesh: AbstractMesh,
    margin: number = 0.8
  ): HitValidationResult {
    // 1. 월드 행렬 강제 업데이트 (정밀한 판정 보장)
    targetMesh.computeWorldMatrix(true);
    targetMesh.getChildMeshes(false).forEach((child) => child.computeWorldMatrix(true));

    // 2. 엄격한 레이캐스트 (Strict Raycast)
    const result = HitScanSystem.doRaycast(
      scene,
      origin,
      direction,
      100, // Range
      (mesh) => mesh.metadata?.id === targetId
    );

    if (result.hit && result.pickedMesh) {
      return {
        isValid: true,
        part: result.pickedMesh.metadata?.bodyPart || 'body',
        method: 'strict',
      };
    }

    // 3. 관대한 판정 (Lenient Validation / Shooter Favor)
    // 레이와 타겟 중심 사이의 최단 거리가 마진(반지름) 이내인지 확인
    const targetPos = targetMesh.getAbsolutePosition();
    const v = targetPos.subtract(origin);
    // d = |(P-O) x direction| / |direction|. direction이 정규화되어 있으므로 분모 생략 가능
    const dist = Vector3.Cross(v, direction).length();

    if (dist < margin) {
      return {
        isValid: true,
        part: 'body',
        method: 'lenient',
        distance: dist,
      };
    }

    return {
      isValid: false,
      part: '',
      method: 'none',
      distance: dist,
    };
  }
}
