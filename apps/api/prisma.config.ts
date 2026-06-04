import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: "../../.env", quiet: true });
dotenv.config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL")
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  }
});
