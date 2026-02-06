import { z } from 'zod';

/**
 * 무기 통계를 검증하기 위한 Zod 스키마.
 * 런타임 시 잘못된 설정 데이터(음수 데미지 등)를 방지합니다.
 */
export const WeaponStatsSchema = z.object({
  name: z.string().min(1, 'Weapon name is required'),
  damage: z.number().min(0, 'Damage cannot be negative'),
  range: z.number().min(0, 'Range cannot be negative'),
  magazineSize: z.number().int().min(0).optional(),
  fireRate: z.number().min(0.01, 'Fire rate must be positive').optional(),
  reloadTime: z.number().min(0.01, 'Reload time must be positive').optional(),
  firingMode: z.enum(['semi', 'auto']).optional(),
  recoilForce: z.number().min(0).optional(),
});

/**
 * WeaponStatsSchema를 기반으로 생성된 TypeScript 타입.
 */
export type WeaponStats = z.infer<typeof WeaponStatsSchema>;

/**
 * 레지스트리에 등록되는 무기 설정 맵 스키마.
 */
export const WeaponRegistrySchema = z.record(z.string(), WeaponStatsSchema);
