export const PROP_PLACEMENT_SCALE_DEFAULT = 1;
export const PROP_PLACEMENT_SCALE_MIN = 0.25;
export const PROP_PLACEMENT_SCALE_MAX = 3;
export const PROP_PLACEMENT_SCALE_STEP = 0.05;
export const VEHICLE_PROP_PLACEMENT_SCALE = 0.75;

export function isVehiclePropItemId(itemId = '') {
  return String(itemId ?? '').startsWith('car_');
}

export function getDefaultPropPlacementScale(source = null) {
  const itemId = typeof source === 'string'
    ? source
    : (source?.itemId ?? source?.id ?? source?.assetName ?? '');

  return isVehiclePropItemId(itemId)
    ? VEHICLE_PROP_PLACEMENT_SCALE
    : PROP_PLACEMENT_SCALE_DEFAULT;
}

export function normalizePropPlacementScale(value, fallback = PROP_PLACEMENT_SCALE_DEFAULT) {
  const numeric = Number(value);
  const fallbackScale = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : PROP_PLACEMENT_SCALE_DEFAULT;
  const source = Number.isFinite(numeric) ? numeric : fallbackScale;
  const clamped = Math.min(PROP_PLACEMENT_SCALE_MAX, Math.max(PROP_PLACEMENT_SCALE_MIN, source));
  return Number(clamped.toFixed(2));
}

export function getPlacementScale(placement = null) {
  return placement?.layer === 'prop'
    ? normalizePropPlacementScale(placement.scale, getDefaultPropPlacementScale(placement))
    : PROP_PLACEMENT_SCALE_DEFAULT;
}
