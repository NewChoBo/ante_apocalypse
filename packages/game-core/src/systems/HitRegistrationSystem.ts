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
    // Prefer explicit head hitboxes first. Some targets use overlapping body/root colliders,
    // and default closest-hit raycast would otherwise classify all head shots as body hits.
    const headResult = HitScanSystem.doRaycast(
      scene,
      origin,
      direction,
      100, // Range
      (mesh) => mesh.metadata?.id === targetId && mesh.metadata?.bodyPart === 'head'
    );
    if (headResult.hit && headResult.pickedMesh) {
      return {
        isValid: true,
        part: 'head',
        method: 'strict',
      };
    }

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
    // 지면 피벗(Feet) 기준인 경우 중심점(1.0m 위)으로 보정
    const targetPos = targetMesh.getAbsolutePosition().add(new Vector3(0, 1.0, 0));
    const v = targetPos.subtract(origin);
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
