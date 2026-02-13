export function normalizePlayerId(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '';
  return String(id);
}

export function isSamePlayerId(
  left: string | number | null | undefined,
  right: string | number | null | undefined
): boolean {
  const normalizedLeft = normalizePlayerId(left);
  const normalizedRight = normalizePlayerId(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
}
