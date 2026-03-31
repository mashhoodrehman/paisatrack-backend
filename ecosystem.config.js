module.exports = {
  apps: [
    {
      name: "paisatrack-api",
      script: "./src/server.js",
      cwd: "/Users/mmr/Herd/MMR/money-track-backend",
      interpreter: "/opt/homebrew/bin/node",
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: "development",
        PORT: 5050
      }
    },
    {
      name: "paisatrack-ngrok",
      script: "/bin/sh",
      args: "./scripts/run-ngrok.sh",
      cwd: "/Users/mmr/Herd/MMR/money-track-backend",
      watch: false,
      autorestart: true,
      env: {
        PORT: 5050
      }
    }
  ]
};
