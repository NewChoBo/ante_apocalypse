import { Observable, Vector3 } from '@babylonjs/core';
import { MuzzleTransform } from '../../types/IWeapon';

/**
 * 타겟이 파괴되었을 때의 데이터 규격
 */
export interface TargetDestroyedInfo {
  targetId: string;
  position: Vector3;
}

/**
 * 전역 게임 Observable 모음.
 * NanoStores(상태)와 달리, 순간적인 '사건'을 전달하는 데 사용합니다.
 */
export const GameObservables = {
  /** 타겟이 파괴됨 */
  targetDestroyed: new Observable<TargetDestroyedInfo>(),

  weaponFire: new Observable<{
    weaponId: string;
    ownerId: string;
    ammoRemaining: number;
    fireType: 'firearm' | 'melee';
    muzzleTransform?: MuzzleTransform;
  }>(),

  /** 타격 발생 (VFX 연출용) */
  hitEffect: new Observable<{ position: Vector3; normal: Vector3 }>(),

  /** 타겟 피격 (상세 정보 포함) */
  targetHit: new Observable<{
    targetId: string;
    part: string;
    damage: number;
    position: Vector3;
  }>(),

  /** 아이템 획득 */
  itemCollection: new Observable<{
    itemId: string;
    position: Vector3;
  }>(),

  /** 플레이어 사망 */
  playerDied: new Observable<null>(),
};
