const passthroughEnvKeys = [
  'PORT',
  'COLYSEUS_PORT',
  'COLOSEUS_PORT',
  'DATABASE_URL',
  'WORLD_KEY',
  'WORLD_LAYOUT_SEED_PATH',
  'WORLD_LAYOUT_PATH',
  'WORLD_PERSISTENCE_ALLOW_FILE_FALLBACK',
  'WORLD_BACKUP_ENABLED',
  'WORLD_BACKUP_WORLD_KEY',
  'WORLD_BACKUP_INTERVAL_MS',
  'WORLD_BACKUP_RECENT_DAYS',
  'WORLD_BACKUP_MAX_DAILY_DAYS',
  'WORLD_BACKUP_PATH',
  'OPENAI_API_KEY',
  'OPENAI_NPC_MODEL',
  'OPENAI_TIMEOUT_MS',
  'ADMIN_KEYS',
  'ADMIN_KEY',
  'AGENT_WORKER_TOKENS',
  'AGENT_WORKER_TOKEN',
  'AGENT_TASKS_FILE_PATH',
  'AGENT_DEPLOYMENTS_FILE_PATH',
  'SERVER_DEBUG',
  'DEBUG_SERVER',
  'NPC_DEBUG'
];

const runtimeEnv = {
  NODE_ENV: 'production'
};

for (const key of passthroughEnvKeys) {
  if (process.env[key] !== undefined) {
    runtimeEnv[key] = process.env[key];
  }
}

module.exports = {
  apps: [
    {
      name: 'stickrpg',
      script: 'server/start-production.mjs',
      time: true,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 120000,
      env: runtimeEnv
    }
  ]
};
