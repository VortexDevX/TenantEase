-- ADMIN enum value was already added by a partially-applied migration.
-- Use IF NOT EXISTS to be idempotent.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ADMIN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
    ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
  END IF;
END $$;

-- Change default from OWNER to TENANT
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'TENANT';
