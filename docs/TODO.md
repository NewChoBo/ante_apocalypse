# TODO: Hit Detection & Networking Improvements

## 1. 사격 판정 고도화 (Hit Detection Advancement)

- [ ] **사격자 위치 검증 (Shooter Position Validation)**: 클라이언트가 보낸 사격 시작점(`origin`)이 서버가 기록한 사격자의 실제 위치와 일치하는지 확인하여 해킹 방지.
- [ ] **히스토리 선형 보간 (Linear Interpolation for Rewind)**: 히스토리 버퍼에서 가장 가까운 시점만 찾는 대신, 두 시점 사이를 보간하여 더 정밀한 지연 보상 구현.
- [ ] **애니메이션 상태 반영 (Animation-State Hitboxes)**: 플레이어의 애니메이션 상태(웅크리기, 점프 등)에 따라 서버 측 히트박스의 오프셋과 크기를 동적으로 조정.

## 2. 네트워크 및 시스템 안정화 (Network & Stability)

- [ ] **린트 경고 해결 (Lint Warning Cleanup)**: 프로젝트 전체의 `any` 타입 제거 및 `console` 로그를 커스텀 로거로 대체. (현재 약 185개 경고 존재)
- [ ] **서버 사이드 디버그 뷰 (Server-Side Debug Visibility)**: 서버에서 되감기된 히트박스 위치를 시각적으로 확인할 수 있는 디버그 도구 또는 로깅 강화.

## 3. 전투 메커니즘 확장 (Combat Mechanics)

- [ ] **멀티파트 데미지 시스템 고도화**: 현재 (Head/Body/Leg) 외에 팔(Arm) 등 추가 부위 세분화 및 부위별 상태 이상(이동 속도 저하 등) 검토.
- [ ] **탄도학 적용 (Ballistics)**: 단순 레이캐스트(Raycast) 사격 외에 중력과 거리에 따른 탄낙차(Bullet Drop) 및 탄속(Bullet Travel Time) 시스템 도입 검토.
