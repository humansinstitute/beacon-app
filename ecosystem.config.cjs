module.exports = {
  apps: [
    {
      name: "main-server",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
    {
      name: "worker-in",
      script: "app/workers/generic.worker.js",
      args: "bm_in",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
    {
      name: "worker-out",
      script: "app/workers/generic.worker.js",
      args: "bm_out",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
