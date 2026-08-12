-- ───────────────────────────────────────────────────────────────────────
-- Casa Paella CRM — migration 0001: add role manager + is_active on users
-- ───────────────────────────────────────────────────────────────────────
-- Safe to run multiple times. The role ENUM is extended in-place.
--
-- Run via phpMyAdmin (paste & execute) or:
--   mysql -u USER -p crm_casa_paella < drizzle/0001_users_roles.sql
-- ───────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;

-- 1) Extend role ENUM to include 'manager' (idempotent via IF NOT EXISTS guard)
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff';

-- 2) Add is_active column if it doesn't already exist
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_active'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1 AFTER `role`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Add index on role for fast filtering (idempotent via guard)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'users_role_idx'
);
SET @ddl := IF(@idx_exists = 0,
  'CREATE INDEX `users_role_idx` ON `users` (`role`)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Ensure all existing users are active
-- (uses id > 0 so MySQL Workbench "Safe Updates" mode is satisfied)
UPDATE `users` SET `is_active` = 1 WHERE `id` > 0 AND (`is_active` IS NULL OR `is_active` = 0);
