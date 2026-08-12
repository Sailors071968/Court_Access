-- DropIndex
DROP INDEX "inmate_source_conflicts_field_idx";

-- DropIndex
DROP INDEX "inmate_watch_list_entries_active_idx";

-- CreateIndex
CREATE INDEX "inmate_bookings_facility_releasedAt_departedRosterAt_booked_idx" ON "inmate_bookings"("facility", "releasedAt", "departedRosterAt", "bookedAt");

-- CreateIndex
CREATE INDEX "inmate_change_events_material_detectedAt_idx" ON "inmate_change_events"("material", "detectedAt");

-- CreateIndex
CREATE INDEX "inmate_ingestion_records_bookingId_idx" ON "inmate_ingestion_records"("bookingId");
