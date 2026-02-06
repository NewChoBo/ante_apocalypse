import { WeaponStats, WeaponRegistrySchema } from '@ante/common';

/**
 * 런타임에 검증된 무기 데이터 레지스트리.
 * @ante/common의 Zod 스키마를 사용하여 데이터 무결성을 보장합니다.
 */
export const rawWeaponRegistry = {
  Pistol: {
    name: 'Pistol',
    damage: 50,
    range: 50,
    magazineSize: 12,
    fireRate: 0.3,
    reloadTime: 1.5,
  },
  Rifle: {
    name: 'Rifle',
    damage: 25,
    range: 100,
    magazineSize: 30,
    fireRate: 0.1,
    reloadTime: 2.0,
  },
  Knife: { name: 'Knife', damage: 50, range: 4 },
  Bat: { name: 'Bat', damage: 100, range: 6 },
  Enemy_Melee: { name: 'Enemy_Melee', damage: 10, range: 3 },
};

/**
 * Zod를 통해 레지스트리 데이터의 유효성을 검사합니다.
 * 에러 발생 시 즉시 리포팅하여 잘못된 설정으로 인한 버그를 미연에 방지합니다.
 */
export const WeaponRegistry = WeaponRegistrySchema.parse(rawWeaponRegistry);

export type { WeaponStats };
