const SERVER_DEBUG_LOGS_ENABLED = false;

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object' || !Object.keys(meta).length) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' [unserializable-meta]';
  }
}

export function logServer(scope, message, meta = null) {
  if (!SERVER_DEBUG_LOGS_ENABLED) {
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${scope}] ${message}${formatMeta(meta)}`);
}

export function logServerError(scope, message, error, meta = null) {
  const timestamp = new Date().toISOString();
  const details = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack, ...(meta ?? {}) }
    : { error, ...(meta ?? {}) };
  console.error(`[${timestamp}] [${scope}] ${message}${formatMeta(details)}`);
}
