-- Separate database for automated tests, so tests can wipe data
-- without touching the dev database.
CREATE DATABASE inquiries_test OWNER inquiry;
