import { Vector3 } from '@babylonjs/core';

/**
 * 총구의 위치와 방향을 제공하는 인터페이스.
 */
export interface IMuzzleProvider {
  getMuzzleTransform(): {
    position: Vector3;
    direction: Vector3;
    transformNode?: any;
  };
}

/**
 * 모든 무기(총기, 근접 무기 등)의 핵심 인터페이스.
 */
export interface IWeapon {
  /** 무기 이름 */
  name: string;

  /** 기본 데미지 */
  damage: number;

  /** 사거리 */
  range: number;

  /** 발사/공격 시도 */
  fire(): boolean;

  /** 공격 시작 (연사 혹은 휘두르기 시작) */
  startFire(): void;

  /** 공격 중지 */
  stopFire(): void;

  /** 매 프레임 업데이트 */
  update(deltaTime: number): void;

  /** 무기 스태츠 가져오기 */
  getStats(): Record<string, unknown>;

  /** 무기 모델 표시 */
  show(): void;

  /** 무기 모델 숨기기 */
  hide(): void;

  /** 정조준 상태 설정 */
  setAiming(isAiming: boolean): void;
}

/**
 * 총기류 전용 인터페이스
 */
export interface IFirearm extends IWeapon, IMuzzleProvider {
  currentAmmo: number;
  magazineSize: number;
  reserveAmmo: number;
  fireRate: number;
  reloadTime: number;
  firingMode: 'semi' | 'auto';
  reload(): void;
}
