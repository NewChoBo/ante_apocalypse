/**
 * 알 수 없는 타입의 에러로부터 에러 메시지를 안전하게 추출합니다.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
