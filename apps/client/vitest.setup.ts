/**
 * Vitest 테스트 설정
 *
 * 모든 테스트 파일에서 사용되는 공통 설정 및 Mock 정의
 */
import { vi, beforeEach, afterEach } from 'vitest';

// 전역 타이머 Mock
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// console Mock (테스트 출력 제어)
const originalConsole = { ...console };

beforeEach(() => {
  // 테스트 중 불필요한 경고 억제
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 전역 에러 핸들러
const errorHandler = (event: ErrorEvent) => {
  // 테스트 중 예상된 에러가 아님을 경고
  if (!event.message.includes('ResizeObserver')) {
    console.warn('Unexpected error:', event.message);
  }
};

// DOM 환경이 아닌 경우 기본 document/body Mock
if (typeof document === 'undefined') {
  global.document = {
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({}),
    body: {},
  } as unknown as Document;
}

if (typeof window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestPointerLock: () => Promise.resolve(),
    exitPointerLock: () => Promise.resolve(),
  } as unknown as Window & typeof globalThis;
}
