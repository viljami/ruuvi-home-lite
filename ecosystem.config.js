module.exports = {
  apps: [{
    name: 'ruuvi-home',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '100M',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      MQTT_HOST: 'localhost',
      MQTT_PORT: '8883',
      MQTT_USER: 'ruuvi'
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};