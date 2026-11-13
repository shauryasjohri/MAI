import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      PORT: "8081",
      MONGODB_URI: "mongodb://127.0.0.1:27017/mai-test",
      OPENAI_API_KEY: "test-key",
      JWT_SECRET: "test-secret-key-at-least-16-characters",
      CORS_ORIGIN: "http://localhost:5173",
      COOKIE_NAME: "mai_token"
    },
    testTimeout: 30000,
    hookTimeout: 120000
  }
});
