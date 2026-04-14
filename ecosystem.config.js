module.exports = {
  apps: [
    {
      name: "worker-expire",
      script: "dist/worker.js",
      env: {
        NODE_ENV: "production",
        OPENAI_API_KEY: "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",
        PG_USER: "postgres",
        PG_PASSWORD: "De}s98}p.Ji9GuVbr97C@",
        PG_HOST: "localhost",
        PG_DATABASE: "anamnex",
        PG_PORT: "5432"
      }
    }
  ]
};
