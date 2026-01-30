import { describe, it, expect } from 'vitest';

// 간단한 수학 연산 로직 예시 (추후 실제 유틸리티 함수로 교체 가능)
const add = (a: number, b: number) => a + b;
const subtract = (a: number, b: number) => a - b;

describe('Math Utils (Sample)', () => {
  it('should add two numbers correctly', () => {
    expect(add(1, 2)).toBe(3);
    expect(add(-1, 5)).toBe(4);
  });

  it('should subtract two numbers correctly', () => {
    expect(subtract(5, 2)).toBe(3);
    expect(subtract(1, 1)).toBe(0);
  });
});
