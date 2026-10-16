-- ───────────────────────────────────────────────────────────────────────
-- Casa Paella CRM — migration 0002: customer first/last name, birth date
-- and pipeline stage.
-- ───────────────────────────────────────────────────────────────────────
-- Safe to run multiple times (each column is added only if missing).
-- The app also applies this automatically on first use
-- (src/server/customer-schema.ts), so running it by hand is optional.
--
-- Run via phpMyAdmin (paste & execute) or:
--   node --env-file=.env scripts/apply-migration.mjs drizzle/0002_customer_pipeline.sql
-- ───────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;

-- 1) first_name
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'first_name');
SET @ddl := IF(@exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `first_name` VARCHAR(120) NULL AFTER `name`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) last_name
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_name');
SET @ddl := IF(@exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `last_name` VARCHAR(120) NULL AFTER `first_name`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) birth_date
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'birth_date');
SET @ddl := IF(@exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `birth_date` DATE NULL AFTER `email`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) pipeline_stage (+ index). Existing customers with activity start as
--    'cliente' (1-2 visits) or 'frecuente' (3+); everyone else as 'nuevo'.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'pipeline_stage');
SET @ddl := IF(@exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `pipeline_stage` VARCHAR(20) NOT NULL DEFAULT ''nuevo'' AFTER `source`, ADD KEY `customers_pipeline_stage_idx` (`pipeline_stage`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @dml := IF(@exists = 0,
  'UPDATE `customers` SET `pipeline_stage` = CASE WHEN `total_orders` + `total_reservations` >= 3 THEN ''frecuente'' WHEN `total_orders` + `total_reservations` >= 1 THEN ''cliente'' ELSE ''nuevo'' END',
  'SELECT 1');
PREPARE stmt FROM @dml; EXECUTE stmt; DEALLOCATE PREPARE stmt;
