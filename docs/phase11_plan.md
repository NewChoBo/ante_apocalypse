# Phase 11 Refactoring Plan

**Date:** 2026-02-04  
**Status:** Planned

---

## 1. Phase 11 Objectives

### 1.1 Primary Goals

| Goal                         | Priority | Description                                |
| ---------------------------- | -------- | ------------------------------------------ |
| **Singleton → DI Migration** | High     | Migrate existing Singleton managers to DI  |
| **Type Safety Improvement**  | Medium   | Replace `any` types with proper interfaces |
| **Code Coverage Expansion**  | Medium   | Add tests for core systems                 |
| **Build Optimization**       | Low      | Reduce bundle size from 7MB                |

### 1.2 Success Metrics

| Metric             | Current     | Target     |
| ------------------ | ----------- | ---------- |
| **Test Coverage**  | 96.55%      | 98%        |
| **Type Errors**    | 16 warnings | 0 warnings |
| **Bundle Size**    | 7MB         | 5MB        |
| **DI Integration** | Partial     | Full       |

---

## 2. Target Files for Refactoring

### 2.1 Singleton Migration Candidates

| File                    | Singleton Method | DI Compatible | Priority |
| ----------------------- | ---------------- | ------------- | -------- |
| `NetworkManager.ts`     | `getInstance()`  | Yes           | High     |
| `WorldEntityManager.ts` | `getInstance()`  | Yes           | High     |
| `PickupManager.ts`      | `getInstance()`  | Yes           | Medium   |
| `TickManager.ts`        | `getInstance()`  | Yes           | Medium   |

### 2.2 Type Safety Improvements

| File                  | Line          | Issue           | Solution                |
| --------------------- | ------------- | --------------- | ----------------------- |
| `BasePawn.ts`         | 26            | `type as any`   | Define PawnType         |
| `CharacterPawn.ts`    | 72            | `unknown`       | Create interface        |
| `GameAssets.ts`       | 51-53, 116    | Dynamic imports | Define AssetType        |
| `RemotePlayerPawn.ts` | 130, 166, 197 | Dynamic state   | Create State interfaces |

### 2.3 Test Coverage Expansion

| Component                | Current Tests | Target Tests |
| ------------------------ | ------------- | ------------ |
| `SessionController`      | 0             | 10           |
| `NetworkManager`         | 0             | 15           |
| `PlayerLifecycleManager` | 0             | 8            |
| `GameAssets`             | 0             | 5            |

---

## 3. Work Breakdown

### 3.1 Sprint 1: Singleton DI Migration (Week 1)

| Task                               | Owner | Duration | Dependencies          |
| ---------------------------------- | ----- | -------- | --------------------- |
| Register NetworkManager in DI      | TBD   | 2h       | DIContainer           |
| Register WorldEntityManager in DI  | TBD   | 2h       | DIContainer           |
| Update SessionController to use DI | TBD   | 4h       | NetworkManager DI     |
| Update EnemyManager to use DI      | TBD   | 2h       | WorldEntityManager DI |

### 3.2 Sprint 2: Type Safety (Week 2)

| Task                         | Owner | Duration | Dependencies          |
| ---------------------------- | ----- | -------- | --------------------- |
| Define PawnType interface    | TBD   | 2h       | @ante/game-core       |
| Create AssetType definitions | TBD   | 4h       | GameAssets refactor   |
| Replace unknown types        | TBD   | 8h       | Interface definitions |

### 3.3 Sprint 3: Test Expansion (Week 3)

| Task                        | Owner | Duration | Dependencies        |
| --------------------------- | ----- | -------- | ------------------- |
| Add SessionController tests | TBD   | 8h       | None                |
| Add NetworkManager tests    | TBD   | 8h       | Mock Photon         |
| Add integration tests       | TBD   | 16h      | Test infrastructure |

---

## 4. Estimated Timeline

| Phase        | Start         | End           | Duration |
| ------------ | ------------- | ------------- | -------- |
| **Sprint 1** | Week 1, Day 1 | Week 1, Day 5 | 5 days   |
| **Sprint 2** | Week 2, Day 1 | Week 2, Day 5 | 5 days   |
| **Sprint 3** | Week 3, Day 1 | Week 3, Day 5 | 5 days   |

**Total Estimated Time:** 15 working days

---

## 5. Risk Assessment

| Risk                                | Impact | Probability | Mitigation            |
| ----------------------------------- | ------ | ----------- | --------------------- |
| **DI Integration Breaking Changes** | High   | Medium      | Incremental migration |
| **Type Definition Conflicts**       | Medium | Low         | Careful review        |
| **Test Flakiness**                  | Low    | Medium      | CI/CD improvements    |

---

## 6. Deliverables

1. **Code Changes:**
   - Updated Singleton classes with DI support
   - New type definitions
   - Expanded test suite

2. **Documentation:**
   - Updated architecture diagram
   - DI usage guidelines
   - Test patterns documentation

3. **Metrics:**
   - Coverage report
   - Bundle analysis
   - Type safety report

---

## 7. Next Steps

1. Review and approve Phase 11 plan
2. Create feature branch `refactor/phase11`
3. Begin Sprint 1 tasks
4. Weekly progress reviews
