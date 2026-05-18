module.exports = {
  apps: [
    {
      name: "skuauditpro",
      script: "server.mjs",
      cwd: "/var/www/skuauditpro/current",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "4173",
        APP_BASE_URL: "https://skuauditpro.com",
        FORCE_HTTPS: "true",
      },
      max_memory_restart: "350M",
      time: true,
    },
  ],
};
