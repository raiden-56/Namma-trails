-- Soft delete for a partner's categories and towns.
-- Before this, changing the selection deleted the old rows. Now a dropped row is kept
-- and marked with the time it was removed, so nothing is lost for good.
ALTER TABLE "provider_categories" ADD COLUMN "removed_at" TIMESTAMPTZ(3);
ALTER TABLE "provider_destinations" ADD COLUMN "removed_at" TIMESTAMPTZ(3);
