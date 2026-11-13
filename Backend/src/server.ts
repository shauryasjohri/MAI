import { app } from "./app.js";
import { connectDB, disconnectDB } from "./db.js";
import { env } from "./config/env.js";

const start = async (): Promise<void> => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
