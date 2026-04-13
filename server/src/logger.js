function readEnabledFlag(value) {
  return ['1', 'true', 'yes', 'on', 'debug'].includes(String(value ?? '').trim().toLowerCase());
}

const SERVER_DEBUG_LOGS_ENABLED = readEnabledFlag(process.env.SERVER_DEBUG ?? process.env.DEBUG_SERVER);
const NPC_DEBUG_LOGS_ENABLED = readEnabledFlag(process.env.NPC_DEBUG);

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

export function logNpcDebug(message, meta = null) {
  if (!NPC_DEBUG_LOGS_ENABLED) {
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [npc-debug] ${message}${formatMeta(meta)}`);
}

export function isNpcDebugEnabled() {
  return NPC_DEBUG_LOGS_ENABLED;
}
