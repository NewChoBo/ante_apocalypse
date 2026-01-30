import { Vector3 } from '@babylonjs/core';
import { DamageProfile } from '../types/IWorldEntity.js';

export class DamageSystem {
  /**
   * 부위별 데미지 배율을 적용하여 최종 데미지를 계산합니다.
   * @param baseDamage 무기의 기본 데미지
   * @param part 맞은 부위 ('head', 'body' 등)
   * @param profile 엔티티의 데미지 설정 (DamageProfile)
   * @returns 소수점이 제거된 최종 데미지 정수
   */
  public static calculateDamage(
    baseDamage: number,
    part: string = 'body',
    profile?: DamageProfile
  ): number {
    if (!profile) return baseDamage;

    const multiplier = profile.multipliers?.[part] ?? profile.defaultMultiplier ?? 1.0;
    return Math.floor(baseDamage * multiplier);
  }

  /**
   * (선택) 거리 감쇄 로직 등을 추가할 수 있는 확장 포인트
   */
  public static calculateDistanceDamage(
    damage: number,
    origin: Vector3,
    hitPoint: Vector3,
    maxRange: number
  ): number {
    const distance = Vector3.Distance(origin, hitPoint);
    if (distance > maxRange) return 0;

    // 간단한 선형 감쇄 예시 (필요시 활성화)
    // const falloff = 1 - (distance / maxRange) * 0.2; // 최대 20% 감소
    // return Math.floor(damage * falloff);

    return damage;
  }
}
