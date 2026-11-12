-- Business invariants enforced by PostgreSQL itself. Prisma cannot express
-- these, so they are appended to migrations. The application checks the same
-- rules first (better error messages); the database is the last line of defence.

-- ── Money and quantities are never negative ─────────────────────────────
ALTER TABLE bookings
  ADD CONSTRAINT bookings_amounts_non_negative CHECK (
    service_subtotal >= 0 AND discount >= 0 AND taxable_value >= 0 AND service_tax >= 0
    AND platform_fee >= 0 AND platform_fee_tax >= 0 AND deposit >= 0 AND total >= 0
  ),
  ADD CONSTRAINT bookings_discount_le_subtotal CHECK (discount <= service_subtotal),
  ADD CONSTRAINT bookings_refund_le_total CHECK (amount_refunded >= 0 AND amount_refunded <= total),
  ADD CONSTRAINT bookings_period_valid CHECK (ends_at >= starts_at),
  ADD CONSTRAINT bookings_party_valid CHECK (units >= 1 AND adults >= 0 AND children >= 0);

ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
ALTER TABLE payment_allocations ADD CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0);
ALTER TABLE refunds ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0);
ALTER TABLE payouts ADD CONSTRAINT payouts_amount_non_negative CHECK (amount >= 0);
ALTER TABLE payouts ADD CONSTRAINT payouts_period_valid CHECK (period_end >= period_start);

ALTER TABLE price_plans
  ADD CONSTRAINT price_plans_amounts_non_negative CHECK (
    base_amount >= 0 AND coalesce(child_amount, 0) >= 0 AND coalesce(per_km_amount, 0) >= 0
    AND coalesce(minimum_fare, 0) >= 0 AND coalesce(extra_adult_amount, 0) >= 0 AND coalesce(deposit_per_unit, 0) >= 0
  );

ALTER TABLE seasonal_price_rules
  ADD CONSTRAINT seasonal_rule_dates_valid CHECK (to_date >= from_date),
  ADD CONSTRAINT seasonal_rule_has_effect CHECK (override_unit_amount IS NOT NULL OR adjustment_bps IS NOT NULL);

ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rate_range CHECK (rate_bps BETWEEN 0 AND 10000 AND coalesce(fixed_amount, 0) >= 0),
  ADD CONSTRAINT commission_validity CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from);

ALTER TABLE tax_rules
  ADD CONSTRAINT tax_rate_range CHECK (rate_bps BETWEEN 0 AND 10000),
  ADD CONSTRAINT tax_validity CHECK (valid_to IS NULL OR valid_to > valid_from);

ALTER TABLE coupons
  ADD CONSTRAINT coupon_value_valid CHECK (
    (kind = 'percent' AND percent_bps BETWEEN 1 AND 10000) OR (kind = 'fixed' AND amount > 0)
  ),
  ADD CONSTRAINT coupon_validity CHECK (valid_to > valid_from),
  ADD CONSTRAINT coupon_redemptions_within_limit CHECK (max_redemptions IS NULL OR redeemed_count <= max_redemptions);

ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

-- ── Inventory can never be oversold ─────────────────────────────────────
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_units_valid CHECK (total_units >= 0 AND capacity >= 1 AND turnaround_mins >= 0);

ALTER TABLE availability_slots
  ADD CONSTRAINT slot_counters_within_capacity CHECK (
    capacity >= 0 AND committed >= 0 AND held >= 0 AND committed + held <= capacity
  ),
  ADD CONSTRAINT slot_period_valid CHECK (ends_at > starts_at);

ALTER TABLE inventory_day_overrides
  ADD CONSTRAINT day_override_units_valid CHECK (total_units IS NULL OR total_units >= 0);

ALTER TABLE inventory_reservations
  ADD CONSTRAINT reservation_units_positive CHECK (units > 0),
  ADD CONSTRAINT reservation_shape CHECK (
    slot_id IS NOT NULL OR night_date IS NOT NULL OR (starts_at IS NOT NULL AND ends_at > starts_at)
  ),
  ADD CONSTRAINT reservation_hold_expires CHECK (kind <> 'hold' OR expires_at IS NOT NULL);

-- A specific cab, boat or guide (or a staff member) cannot be assigned to two overlapping bookings.
ALTER TABLE booking_assignments
  ADD CONSTRAINT assignment_period_valid CHECK (ends_at > starts_at),
  ADD CONSTRAINT assignment_has_target CHECK (inventory_item_id IS NOT NULL OR member_id IS NOT NULL),
  ADD CONSTRAINT assignment_no_overlap_resource EXCLUDE USING gist (
    inventory_item_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (released_at IS NULL AND inventory_item_id IS NOT NULL),
  ADD CONSTRAINT assignment_no_overlap_member EXCLUDE USING gist (
    member_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (released_at IS NULL AND member_id IS NOT NULL);

-- ── Uniqueness that depends on state ────────────────────────────────────
-- One active owner per provider organisation.
CREATE UNIQUE INDEX provider_members_one_owner ON provider_members (provider_id)
  WHERE role = 'owner' AND status = 'active';

-- One primary payout account per provider.
CREATE UNIQUE INDEX payout_accounts_one_primary ON payout_accounts (provider_id) WHERE is_primary;

-- One current (non-superseded) document per provider/type/asset.
CREATE UNIQUE INDEX provider_documents_one_current ON provider_documents (provider_id, document_type_id, inventory_item_id)
  NULLS NOT DISTINCT WHERE status <> 'superseded';

CREATE UNIQUE INDEX document_requirements_scope_key ON document_requirements (category_id, document_type_id, state, district)
  NULLS NOT DISTINCT;

ALTER TABLE services
  ADD CONSTRAINT services_published_has_timestamp CHECK (status <> 'published' OR published_at IS NOT NULL),
  ADD CONSTRAINT services_participants_valid CHECK (
    min_participants >= 1 AND (max_participants IS NULL OR max_participants >= min_participants)
  );

-- ── Geospatial and search indexes ───────────────────────────────────────
CREATE INDEX providers_location_gix ON providers USING gist (location);
CREATE INDEX destinations_location_gix ON destinations USING gist (location);
CREATE INDEX attractions_location_gix ON attractions USING gist (location);
CREATE INDEX service_locations_location_gix ON service_locations USING gist (location);
CREATE INDEX services_title_trgm ON services USING gin (title gin_trgm_ops);
CREATE INDEX services_published_idx ON services (destination_id, category_id, from_price)
  WHERE status = 'published' AND deleted_at IS NULL;

-- ── Append-only history tables ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER booking_status_history_append_only BEFORE UPDATE OR DELETE ON booking_status_history
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER provider_verification_events_append_only BEFORE UPDATE OR DELETE ON provider_verification_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
