-- Add missing enum values idempotently so shadow DB creation is stable.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TENANT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
    ALTER TYPE "UserRole" ADD VALUE 'TENANT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ADMIN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
    ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
  END IF;
END $$;
