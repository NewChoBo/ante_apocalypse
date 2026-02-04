# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **DI Container Architecture**: Implemented dependency injection container for testable code
- **MovementConfig**: Centralized movement constants
- **FirearmConfig**: Centralized firearm constants
- **PlayerLifecycleManager**: New class for player lifecycle management
- **Unit Tests**: 38 tests with 96.55% coverage
- **Vitest Setup**: Test infrastructure with coverage thresholds

### Changed

- **English Comments**: Translated Korean comments to English
- **Magic Numbers**: Replaced with configuration constants
- **SessionController**: Refactored to use PlayerLifecycleManager

### Fixed

- No bugs fixed in this release

### Removed

- No files removed (cleanup analysis found no unused files)

---

## [1.0.0] - 2026-02-04

### Initial Refactoring Release (Phase 1-10 Complete)

#### Architecture Improvements

- ✅ DI Container implementation
- ✅ Configuration file separation
- ✅ God Class separation (PlayerLifecycleManager)
- ✅ Test coverage expansion (5 → 38 tests)

#### Code Quality

- ✅ Magic number elimination (20+ → 0)
- ✅ English comment standardization
- ✅ TypeScript strict mode compliance
- ✅ ESLint + Prettier integration

#### Build & Testing

- ✅ Vitest configuration with coverage thresholds
- ✅ 96.55% test coverage (Statements)
- ✅ 100% branch coverage
- ✅ Production build verification

#### Documentation

- ✅ Maintainability analysis report
- ✅ Refactoring progress tracking
- ✅ Cleanup analysis report
- ✅ Phase 11 planning document

---

## Metrics Comparison

| Metric                | Before | After  | Change  |
| --------------------- | ------ | ------ | ------- |
| Test Count            | 5      | 38     | +707%   |
| Coverage              | <1%    | 96.55% | +95%    |
| Magic Numbers         | 20+    | 0      | Removed |
| God Classes           | 3      | 1      | -66%    |
| Maintainability Score | 68/100 | 82/100 | +14     |

---

## Files Changed

### Added (10 files)

- `apps/client/src/config/FirearmConfig.ts`
- `apps/client/src/config/MovementConfig.ts`
- `apps/client/src/config/index.ts`
- `apps/client/src/config/__tests__/config.test.ts`
- `apps/client/src/core/di/DIContainer.ts`
- `apps/client/src/core/di/index.ts`
- `apps/client/src/core/di/ServiceRegistration.ts`
- `apps/client/src/core/di/__tests__/DIContainer.test.ts`
- `apps/client/src/core/systems/PlayerLifecycleManager.ts`
- `apps/client/vitest.config.ts`

### Modified (10 files)

- `apps/client/src/core/BasePawn.ts`
- `apps/client/src/core/components/CharacterMovementComponent.ts`
- `apps/client/src/core/systems/EnemyManager.ts`
- `apps/client/src/core/systems/SessionController.ts`
- `apps/client/src/weapons/Firearm.ts`
- `apps/client/src/weapons/MeleeWeapon.ts`
- `apps/client/src/weapons/ProceduralWeaponBuilder.ts`
- `apps/client/src/weapons/WeaponVisualController.ts`
- `vitest.config.ts`
- `vitest.setup.ts`

### Documentation (3 files)

- `docs/maintainability_analysis_report.md`
- `docs/refactoring_progress.md`
- `docs/cleanup_analysis_report.md`
- `docs/phase11_plan.md`

---

## Known Issues

### TypeScript Warnings (16 total)

The following files have `any` type warnings that require `@ante/game-core` type definitions review:

- `BasePawn.ts` - `type as any` (line 26)
- `CharacterPawn.ts` - `unknown` (line 72)
- `EnemyPawn.ts` - `unknown` (line 32)
- `GameAssets.ts` - Dynamic imports (lines 51-53, 116)
- `PlayerPawn.ts` - `any` (line 193)
- `RemotePlayerPawn.ts` - Dynamic state (lines 130, 166, 197)
- `CharacterMovementComponent.ts` - `unknown` (line 64)
- `FirearmEffectComponent.ts` - Event data (lines 75, 78)

### Planned Improvements (Phase 11)

- Singleton → DI migration for NetworkManager, WorldEntityManager, etc.
- Type safety improvements for `any` warnings
- Additional test coverage for core systems
- Bundle size optimization (7MB → 5MB target)

---

## Links

- **Repository**: https://github.com/newchobo/ante_apocalypse
- **Documentation**: See `/docs` folder
- **Phase 11 Plan**: [docs/phase11_plan.md](docs/phase11_plan.md)
