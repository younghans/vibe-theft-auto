module.exports = {
  apps: [
    {
      name: 'vibe-theft-auto',
      script: 'server/start-production.mjs',
      time: true,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 120000
    }
  ]
};
