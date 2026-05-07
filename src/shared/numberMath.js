export function quantizeNumber(value, digits = 2) {
  const numeric = Number(value ?? 0);
  return Number((Number.isFinite(numeric) ? numeric : 0).toFixed(digits));
}

export function quantizePosition(value) {
  return quantizeNumber(value, 2);
}

export function quantizeRotation(value) {
  return quantizeNumber(value, 3);
}

export function normalizeRotationQuarterTurns(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return ((Math.round(numeric) % 4) + 4) % 4;
}

export function rotationQuarterTurnsToRadians(rotationQuarterTurns = 0) {
  return normalizeRotationQuarterTurns(rotationQuarterTurns) * (Math.PI / 2);
}

export function rotationRadiansToQuarterTurns(rotationY) {
  return normalizeRotationQuarterTurns(Math.round(Number(rotationY ?? 0) / (Math.PI / 2)));
}
