-- Migration 0002: remember the Square business name so /api/square/status can
-- say "Connected to <name>" without calling Square on every page load.
ALTER TABLE connections ADD COLUMN business_name TEXT;
