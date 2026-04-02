module.exports = {
  apps: [
    {
      name: 'stickrpg',
      script: 'server/index.mjs',
      time: true,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
