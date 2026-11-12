-- Extensions required by the schema. Must run before table creation.
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive emails / coupon codes
CREATE EXTENSION IF NOT EXISTS postgis;     -- geography(Point) for geo search
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraints mixing = and &&
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search on listings
