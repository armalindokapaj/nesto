-- Phase 2 — per-event email opt-in, defaulting off so enabling the channel
-- does not retroactively email every event in the catalogue.
ALTER TABLE "NotificationPolicy" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;
