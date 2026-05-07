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
      env: {
        NODE_ENV: 'production'
      }
    }
  ],
  deploy: {
    production: {
      'post-setup': 'ln -sfn /home/deploy/source /home/deploy/current'
    }
  }
};
