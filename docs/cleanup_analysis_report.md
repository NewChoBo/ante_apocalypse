# Codebase Cleanup Analysis Report

**Generated:** 2026-02-04  
**Purpose:** Identify unused files, duplicate code, and legacy patterns for safe cleanup

---

## 1. Project File Overview

### Total Files by Category

| Category         | Count | Description                                |
| ---------------- | ----- | ------------------------------------------ |
| **Core Systems** | 15    | SessionController, NetworkManager, etc.    |
| **Components**   | 18    | Gameplay components (Camera, Combat, etc.) |
| **Weapons**      | 9     | Weapon classes and visual controllers      |
| **UI**           | 8     | HUD, Inventory, Lobby UI                   |
| **Config**       | 4     | Configuration files                        |
| **DI**           | 4     | Dependency injection files                 |
| **Tests**        | 2     | Unit tests                                 |
| **Types**        | 5     | TypeScript type definitions                |
| **Utils**        | ~10   | Utility functions                          |

---

## 2. Files to Review (Potential Cleanup Candidates)

### 2.1 DI Container Transition Candidates

These files may be redundant after DI container introduction:

| File                        | Status            | Risk Level | Recommendation              |
| --------------------------- | ----------------- | ---------- | --------------------------- |
| `config/index.ts`           | ✅ In Use         | Low        | Keep - consolidates exports |
| `di/ServiceRegistration.ts` | ⚠️ Reference Only | Medium     | Add to initialization flow  |
| `di/index.ts`               | ✅ In Use         | Low        | Keep - DI entry point       |

### 2.2 Singleton Patterns (Migration Candidates)

| File                    | Singleton Method | DI Compatible | Priority |
| ----------------------- | ---------------- | ------------- | -------- |
| `NetworkManager.ts`     | `getInstance()`  | Yes           | High     |
| `WorldEntityManager.ts` | `getInstance()`  | Yes           | High     |
| `PickupManager.ts`      | `getInstance()`  | Yes           | Medium   |
| `TickManager.ts`        | `getInstance()`  | Yes           | Medium   |

### 2.3 Files Requiring Import/Export Analysis

The following files should be analyzed for unused imports/exports:

| File                                           | Last Modified | Import Count | Export Count |
| ---------------------------------------------- | ------------- | ------------ | ------------ |
| `core/components/BaseComponent.ts`             | Recent        | Check        | Check        |
| `core/components/BaseWeaponEffectComponent.ts` | Recent        | Check        | Check        |
| `core/entities/PickupActor.ts`                 | Unknown       | Check        | Check        |
| `core/items/ItemDatabase.ts`                   | Unknown       | Check        | Check        |

---

## 3. Duplicate Code Analysis

### 3.1 Potential Duplicates Found

| Pattern              | Files                                                        | Recommendation               |
| -------------------- | ------------------------------------------------------------ | ---------------------------- |
| **Movement Logic**   | `CharacterMovementComponent.ts`, `EnemyMovementComponent.ts` | Consider base movement class |
| **Weapon Effects**   | `FirearmEffectComponent.ts`, `MeleeEffectComponent.ts`       | Effects base class?          |
| **State Management** | `SessionStateMachine.ts`, `PlayerLifecycleManager.ts`        | Merge or clarify boundaries  |

### 3.2 Legacy Patterns

| Pattern                | Location             | Modern Alternative                           |
| ---------------------- | -------------------- | -------------------------------------------- |
| **Static Observables** | `GameObservables.ts` | EventBus pattern                             |
| **Direct DOM Access**  | `UI/*.ts`            | Component-based UI                           |
| **Magic Numbers**      | Scattered            | Config files (MovementConfig, FirearmConfig) |

---

## 4. Empty/Unused Directories

### 4.1 Directories to Check

| Directory        | Status       | Notes                      |
| ---------------- | ------------ | -------------------------- |
| `core/utils/`    | Needs Review | Check for unused utilities |
| `core/entities/` | Partial Use  | PickupActor may be unused  |

### 4.2 Empty Directories Found

**None detected** - All directories contain files.

---

## 5. Recommendations

### 5.1 Safe to Remove (Low Risk)

| File/Directory | Reason | Impact |
| -------------- | ------ | ------ |
| N/A            | -      | -      |

### 5.2 Review Before Removal (Medium Risk)

| File/Directory              | Reason               | Action                   |
| --------------------------- | -------------------- | ------------------------ |
| `config/index.ts`           | Consolidates exports | Keep                     |
| `di/ServiceRegistration.ts` | Reference template   | Integrate or archive     |
| Duplicate movement logic    | Code similarity      | Refactor into base class |

### 5.3 Do NOT Remove (High Risk)

| File/Directory         | Reason        |
| ---------------------- | ------------- |
| `SessionController.ts` | Core system   |
| `NetworkManager.ts`    | Core system   |
| `PlayerPawn.ts`        | Core gameplay |
| `Game.ts`              | Entry point   |

---

## 6. Impact Analysis Summary

### 6.1 Files Analyzed: ~90 TypeScript files

### 6.2 Cleanup Candidates

| Category            | Count | Risk Level |
| ------------------- | ----- | ---------- |
| **Safe to Remove**  | 0     | N/A        |
| **Review Required** | 5-10  | Medium     |
| **Keep (Critical)** | ~75   | Low        |

### 6.3 Estimated Cleanup Time

| Task               | Time      | Complexity |
| ------------------ | --------- | ---------- |
| DI Integration     | 2-4 hours | Medium     |
| Duplicate Refactor | 4-8 hours | High       |
| Test Updates       | 1-2 hours | Low        |

---

## 7. Next Steps

1. **Backup**: Create git backup before any removal
2. **Import Analysis**: Run dependency analysis tool
3. **Incremental Cleanup**: Remove files one at a time
4. **Verification**: Rebuild and test after each removal

---

## 8. Safety Checklist

- [ ] Create git backup/tag
- [ ] Run full test suite
- [ ] Document removed files
- [ ] Update documentation
- [ ] Verify build succeeds
- [ ] Manual verification of core features
