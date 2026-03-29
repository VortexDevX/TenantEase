import { createApp } from "./app.js";
import { env } from "./lib/env.js";

async function main() {
  const app = createApp();
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

