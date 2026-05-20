import { quantizePosition } from './numberMath.js';

export const PASSIVE_TRAFFIC_ROUTE_SCHEMA_VERSION = 1;
export const PASSIVE_TRAFFIC_ROUTE_MIN_POINTS = 4;

function normalizeRouteId(value = '', fallback = '') {
  const normalized = String(value ?? '').trim().slice(0, 80);
  return normalized || fallback;
}

function normalizeRouteItemId(value = '') {
  return String(value ?? '').trim().slice(0, 80);
}

function normalizeRouteLabel(value = '') {
  return String(value ?? '').trim().slice(0, 48);
}

export function normalizePassiveTrafficRoutePoint(point = null) {
  const x = Number(point?.x ?? point?.position?.[0]);
  const z = Number(point?.z ?? point?.position?.[1]);
  const cellX = Number(point?.cellX ?? point?.cell?.[0]);
  const cellZ = Number(point?.cellZ ?? point?.cell?.[1]);
  const hasPosition = Number.isFinite(x) && Number.isFinite(z);
  const hasCell = Number.isFinite(cellX) && Number.isFinite(cellZ);
  if (!hasPosition && !hasCell) {
    return null;
  }

  return {
    ...(hasCell ? {
      cellX: Math.round(cellX),
      cellZ: Math.round(cellZ)
    } : {}),
    ...(hasPosition ? {
      x: quantizePosition(x),
      z: quantizePosition(z)
    } : {})
  };
}

function routePointKey(point = null) {
  if (Number.isFinite(Number(point?.cellX)) && Number.isFinite(Number(point?.cellZ))) {
    return `${Math.round(Number(point.cellX))}:${Math.round(Number(point.cellZ))}`;
  }
  return `${quantizePosition(point?.x ?? 0)}:${quantizePosition(point?.z ?? 0)}`;
}

function normalizePassiveTrafficRoutePoints(points = []) {
  const normalized = [];
  for (const point of Array.isArray(points) ? points : []) {
    const nextPoint = normalizePassiveTrafficRoutePoint(point);
    if (!nextPoint) {
      continue;
    }

    if (routePointKey(normalized[normalized.length - 1]) === routePointKey(nextPoint)) {
      continue;
    }
    normalized.push(nextPoint);
  }

  return normalized;
}

export function isPassiveTrafficRouteClosed(route = null) {
  const points = Array.isArray(route?.points) ? route.points : [];
  if (points.length < PASSIVE_TRAFFIC_ROUTE_MIN_POINTS) {
    return false;
  }

  return routePointKey(points[0]) === routePointKey(points[points.length - 1]);
}

export function normalizePassiveTrafficRoute(route = null) {
  const itemId = normalizeRouteItemId(route?.itemId);
  if (!itemId) {
    return null;
  }

  const points = normalizePassiveTrafficRoutePoints(route?.points);
  if (points.length && routePointKey(points[0]) !== routePointKey(points[points.length - 1])) {
    points.push({ ...points[0] });
  }

  const fallbackId = `traffic_route_${itemId}`;
  const normalized = {
    id: normalizeRouteId(route?.id, fallbackId),
    itemId,
    label: normalizeRouteLabel(route?.label),
    closed: true,
    points,
    schemaVersion: PASSIVE_TRAFFIC_ROUTE_SCHEMA_VERSION
  };

  return isPassiveTrafficRouteClosed(normalized) ? normalized : null;
}

export function normalizePassiveTrafficRoutes(routes = []) {
  const normalized = [];
  const seenItemIds = new Set();
  for (const route of Array.isArray(routes) ? routes : []) {
    const nextRoute = normalizePassiveTrafficRoute(route);
    if (!nextRoute || seenItemIds.has(nextRoute.itemId)) {
      continue;
    }
    normalized.push(nextRoute);
    seenItemIds.add(nextRoute.itemId);
  }
  return normalized;
}

export function clonePassiveTrafficRoutes(routes = []) {
  return normalizePassiveTrafficRoutes(routes);
}
