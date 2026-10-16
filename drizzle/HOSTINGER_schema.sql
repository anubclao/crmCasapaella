-- ═══════════════════════════════════════════════════════════════════════
-- Casa Paella CRM — Hostinger MySQL schema (consolidated)
-- ═══════════════════════════════════════════════════════════════════════
-- Source of truth: drizzle/schema.ts (Drizzle ORM).
-- This file is auto-aligned with the TS schema and includes:
--   • 0000_init.sql
--   • 0001_users_roles.sql (manager role + is_active)
--   • 0002_customer_pipeline.sql (first/last name, birth date, pipeline stage)
--
-- Run ONCE on a fresh Hostinger MySQL database.
-- ═══════════════════════════════════════════════════════════════════════

-- How to run from Hostinger hPanel:
--   1. hPanel → Databases → MySQL → "Manage" (phpMyAdmin)
--   2. Select the database (e.g. u123456_crmcasapaella)
--   3. Click "SQL" tab → paste this file → Go
--
-- How to run from CLI (if you have SSH):
--   mysql -u DB_USER -p DB_NAME < drizzle/HOSTINGER_schema.sql
-- ═══════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Users (CRM staff) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_idx` (`email`),
  KEY `users_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Customers (leads + active clients) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(120) NULL,
  `last_name` VARCHAR(120) NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(255) NULL,
  `birth_date` DATE NULL,
  `source` ENUM('web_reservation', 'web_order', 'manual', 'import', 'whatsapp_inbound') NOT NULL DEFAULT 'manual',
  `pipeline_stage` VARCHAR(20) NOT NULL DEFAULT 'nuevo',
  `total_reservations` INT NOT NULL DEFAULT 0,
  `total_orders` INT NOT NULL DEFAULT 0,
  `total_spent` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `last_activity_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_phone_idx` (`phone`),
  KEY `customers_email_idx` (`email`),
  KEY `customers_last_activity_idx` (`last_activity_at`),
  KEY `customers_pipeline_stage_idx` (`pipeline_stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tags (master list) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tags` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(7) NULL DEFAULT '#C1272D',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Customer ↔ Tag (M2M) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customer_tags` (
  `customer_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`, `tag_id`),
  KEY `customer_tags_tag_idx` (`tag_id`),
  CONSTRAINT `customer_tags_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_tags_tag_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Reservations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reservations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `reservation_date` DATETIME NOT NULL,
  `guests` INT NOT NULL DEFAULT 2,
  `status` ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reservations_date_idx` (`reservation_date`),
  KEY `reservations_customer_idx` (`customer_id`),
  KEY `reservations_status_idx` (`status`),
  CONSTRAINT `reservations_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Orders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `order_type` ENUM('delivery', 'pickup', 'dine_in') NOT NULL DEFAULT 'delivery',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `status` ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `items` JSON NULL,
  `delivery_address` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `orders_customer_idx` (`customer_id`),
  KEY `orders_status_idx` (`status`),
  KEY `orders_created_idx` (`created_at`),
  CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Campaigns ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `target_type` ENUM('all', 'tag', 'inactive_days') NOT NULL DEFAULT 'all',
  `target_value` VARCHAR(255) NULL,
  `template_name` VARCHAR(100) NULL,
  `status` ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled') NOT NULL DEFAULT 'draft',
  `scheduled_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `recipients_count` INT NOT NULL DEFAULT 0,
  `delivered_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `created_by` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaigns_status_idx` (`status`),
  KEY `campaigns_scheduled_idx` (`scheduled_at`),
  CONSTRAINT `campaigns_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Message templates (versioned, with Meta Cloud mapping) ──────────────
CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('transactional', 'marketing', 'utility') NOT NULL DEFAULT 'transactional',
  `language` VARCHAR(10) NOT NULL DEFAULT 'es',
  `body` TEXT NOT NULL,
  `variables` JSON NULL,
  `meta_template_id` VARCHAR(255) NULL,
  `meta_status` ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_templates_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Messages log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NULL,
  `campaign_id` INT NULL,
  `direction` ENUM('outbound', 'inbound') NOT NULL,
  `channel` ENUM('whatsapp', 'sms', 'email') NOT NULL DEFAULT 'whatsapp',
  `template_name` VARCHAR(100) NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('queued', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'queued',
  `provider_message_id` VARCHAR(255) NULL,
  `error` TEXT NULL,
  `sent_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `messages_customer_idx` (`customer_id`),
  KEY `messages_campaign_idx` (`campaign_id`),
  KEY `messages_status_idx` (`status`),
  KEY `messages_created_idx` (`created_at`),
  CONSTRAINT `messages_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `messages_campaign_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════════════
-- SEED DATA (idempotent)
-- ═══════════════════════════════════════════════════════════════════════

-- Default tags
INSERT INTO `tags` (`name`, `color`) VALUES
  ('Cliente Nuevo', '#3B82F6'),
  ('Frecuente', '#10B981'),
  ('VIP', '#C9A961'),
  ('Prefiere Domicilio', '#F59E0B'),
  ('Reserva Cumpleaños', '#EC4899'),
  ('Inactivo', '#9CA3AF')
ON DUPLICATE KEY UPDATE `color` = VALUES(`color`);

-- Default message templates
INSERT INTO `message_templates`
  (`name`, `category`, `language`, `body`, `variables`, `is_active`)
VALUES
  ('casapaella_reserva_confirmada', 'utility', 'es',
   '¡Hola {{nombre}}! 🍤 Tu reserva en {{restaurant}} para el {{date}} a las {{time}} para {{guests}} personas está confirmada. ¡Te esperamos! Cualquier cambio responde a este mensaje.',
   JSON_ARRAY('nombre', 'restaurant', 'date', 'time', 'guests'), 1),
  ('casapaella_pedido_recibido', 'utility', 'es',
   '¡Hola {{nombre}}! 👨‍🍫 Recibimos tu pedido en {{restaurant}}. Total: ${{total}} COP. Ya está en preparación y te avisaremos cuando esté listo. {{address}}',
   JSON_ARRAY('nombre', 'restaurant', 'total', 'address'), 1),
  ('casapaella_promocion_generica', 'marketing', 'es',
   '¡Hola {{nombre}}! {{restaurant}} te tiene una promo especial. {{body}}',
   JSON_ARRAY('nombre', 'restaurant', 'body'), 1)
ON DUPLICATE KEY UPDATE
  `body` = VALUES(`body`),
  `variables` = VALUES(`variables`),
  `is_active` = VALUES(`is_active`);

-- ═══════════════════════════════════════════════════════════════════════
-- OPTIONAL: Pre-create the admin user
-- ═══════════════════════════════════════════════════════════════════════
-- The app auto-creates an admin on first boot via the instrumentation
-- hook (src/instrumentation.ts → src/server/seed.ts).
-- Default credentials: admin@casapaella.com.co / admin1234
-- (CHANGE THE PASSWORD IMMEDIATELY in production via /settings).
--
-- If you want to pre-create one with a known password instead of
-- waiting for auto-seed, generate a bcrypt hash locally:
--   node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD',10))"
-- Then uncomment and replace the INSERT below:
--
-- INSERT INTO `users` (`email`, `password_hash`, `name`, `role`, `is_active`)
-- VALUES ('admin@casapaella.com.co', '$2a$10$...HASH...', 'Admin Casa Paella', 'admin', 1);
-- ═══════════════════════════════════════════════════════════════════════
