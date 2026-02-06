import { Vector3 } from '@babylonjs/core';

/**
 * 근접 무기 애니메이션 설정 인터페이스
 */
export interface MeleeAnimationConfig {
  /** 애니메이션 지속 시간 (초) */
  duration: number;
  /** 휘두르기 각도 (라디안) */
  swingAngle: number;
  /** 앞으로 날아가는 거리 */
  forwardOffset: number;
  /** Z축 회전 보정 */
  zRotationOffset?: number;
  /** X축 회전 보정 */
  xRotationOffset?: number;
}

/**
 * 근접 무기 메시 위치/회전 설정 인터페이스
 */
export interface MeleeTransformConfig {
  /** 기본 위치 */
  position: { x: number; y: number; z: number };
  /** 기본 회전 */
  rotation: { x: number; y: number; z: number };
}

/**
 * 근접 무기 설정 인터페이스
 */
export interface MeleeWeaponConfig {
  /** 무기 이름 */
  name: string;
  /** 기본 데미지 */
  damage: number;
  /** 공격 범위 */
  range: number;
  /** 메시 위치/회전 설정 */
  transform: MeleeTransformConfig;
  /** 애니메이션 설정 */
  animation: MeleeAnimationConfig;
}

/**
 * 근접 무기 설정 레지스트리
 */
export const MeleeWeaponConfigs: Record<string, MeleeWeaponConfig> = {
  Knife: {
    name: 'Knife',
    damage: 50,
    range: 4,
    transform: {
      position: { x: 0.45, y: -0.4, z: 0.65 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
    },
    animation: {
      duration: 0.4,
      swingAngle: 0.8,
      forwardOffset: 0.2,
    },
  },
  Bat: {
    name: 'Bat',
    damage: 100,
    range: 6,
    transform: {
      position: { x: 0.5, y: -0.5, z: 0.75 },
      rotation: { x: Math.PI / 2.5, y: 0, z: Math.PI / 4 },
    },
    animation: {
      duration: 0.8,
      swingAngle: 1.5,
      forwardOffset: 0,
      zRotationOffset: -1, // Bat은 z축 회전이 주요
      xRotationOffset: 0.5,
    },
  },
};

/**
 * Vector3로 변환 헬퍼 함수
 */
export function toVector3(config: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(config.x, config.y, config.z);
}
