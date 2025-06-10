module.exports = {
  apps: [
    {
      name: "ruuvi-home",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,

      // Resource limits and security
      max_memory_restart: "100M",
      max_restarts: 5,
      min_uptime: "30s",
      restart_delay: 5000,

      // Environment configuration
      env_file: ".env",
      env: {
        NODE_ENV: "production",
        MQTT_HOST: "localhost",
        MQTT_PORT: "8883",
        MQTT_USER: "ruuvi",
      },

      // Logging configuration
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_file: "logs/combined.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,

      // Process monitoring
      autorestart: true,
      watch: false,
      ignore_watch: ["node_modules", "logs", "*.db"],

      // Health monitoring
      health_check_grace_period: 3000,
      health_check_interval: 30000,

      // Advanced PM2 features
      source_map_support: true,
      instance_var: "INSTANCE_ID",

      // Error handling
      exp_backoff_restart_delay: 100,
      listen_timeout: 8000,
      kill_timeout: 5000,

      // Node.js specific options
      node_args: ["--max-old-space-size=128", "--enable-source-maps"],
    },
  ],
};
