-- ───────────────────────────────────────────────────────────────────────
-- Casa Paella CRM — initial MySQL schema
-- ───────────────────────────────────────────────────────────────────────
-- Run order:
--   1. In phpMyAdmin (hPanel): paste the contents of this file and execute.
--   2. Or via mysql CLI:
--        mysql -u USER -p crm_casa_paella < drizzle/0000_init.mysql.sql
--   3. After running `drizzle-kit generate`, run `npm run db:strip` to
--      produce drizzle/0000_init.mysql.sql (strips `-->` breakpoints
--      that break MySQL CLI).
-- ───────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `email` VARCHAR(255),
  `source` ENUM('web_reservation', 'web_order', 'manual', 'import', 'whatsapp_inbound') NOT NULL DEFAULT 'manual',
  `total_reservations` INT NOT NULL DEFAULT 0,
  `total_orders` INT NOT NULL DEFAULT 0,
  `total_spent` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `last_activity_at` DATETIME,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_phone_idx` (`phone`),
  KEY `customers_email_idx` (`email`),
  KEY `customers_last_activity_idx` (`last_activity_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tags` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(7) DEFAULT '#C1272D',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_tags` (
  `customer_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`, `tag_id`),
  KEY `customer_tags_tag_idx` (`tag_id`),
  CONSTRAINT `customer_tags_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_tags_tag_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reservations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `reservation_date` DATETIME NOT NULL,
  `guests` INT NOT NULL DEFAULT 2,
  `status` ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reservations_date_idx` (`reservation_date`),
  KEY `reservations_customer_idx` (`customer_id`),
  KEY `reservations_status_idx` (`status`),
  CONSTRAINT `reservations_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT NOT NULL,
  `order_type` ENUM('delivery', 'pickup', 'dine_in') NOT NULL DEFAULT 'delivery',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `status` ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `items` JSON,
  `delivery_address` TEXT,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `orders_customer_idx` (`customer_id`),
  KEY `orders_status_idx` (`status`),
  KEY `orders_created_idx` (`created_at`),
  CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `target_type` ENUM('all', 'tag', 'inactive_days') NOT NULL DEFAULT 'all',
  `target_value` VARCHAR(255),
  `template_name` VARCHAR(100),
  `status` ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled') NOT NULL DEFAULT 'draft',
  `scheduled_at` DATETIME,
  `sent_at` DATETIME,
  `recipients_count` INT NOT NULL DEFAULT 0,
  `delivered_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `created_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaigns_status_idx` (`status`),
  KEY `campaigns_scheduled_idx` (`scheduled_at`),
  CONSTRAINT `campaigns_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('transactional', 'marketing', 'utility') NOT NULL DEFAULT 'transactional',
  `language` VARCHAR(10) NOT NULL DEFAULT 'es',
  `body` TEXT NOT NULL,
  `variables` JSON,
  `meta_template_id` VARCHAR(255),
  `meta_status` ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  `is_active` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_templates_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT,
  `campaign_id` INT,
  `direction` ENUM('outbound', 'inbound') NOT NULL,
  `channel` ENUM('whatsapp', 'sms', 'email') NOT NULL DEFAULT 'whatsapp',
  `template_name` VARCHAR(100),
  `body` TEXT NOT NULL,
  `status` ENUM('queued', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'queued',
  `provider_message_id` VARCHAR(255),
  `error` TEXT,
  `sent_at` DATETIME,
  `delivered_at` DATETIME,
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

-- ── Seed default tags ─────────────────────────────────────────────────────
INSERT INTO `tags` (`name`, `color`) VALUES
  ('Cliente Nuevo', '#3B82F6'),
  ('Frecuente', '#10B981'),
  ('VIP', '#C9A961'),
  ('Prefiere Domicilio', '#F59E0B'),
  ('Reserva Cumpleaños', '#EC4899'),
  ('Inactivo', '#9CA3AF')
ON DUPLICATE KEY UPDATE `color` = VALUES(`color`);

-- ── Seed default message templates ───────────────────────────────────────
INSERT INTO `message_templates` (`name`, `category`, `language`, `body`, `variables`) VALUES
  ('casapaella_reserva_confirmada', 'utility', 'es',
   '¡Hola {{nombre}}! 🍤 Tu reserva en {{restaurant}} para el {{date}} a las {{time}} para {{guests}} personas está confirmada. ¡Te esperamos! Cualquier cambio responde a este mensaje.',
   JSON_ARRAY('nombre', 'restaurant', 'date', 'time', 'guests')),
  ('casapaella_pedido_recibido', 'utility', 'es',
   '¡Hola {{nombre}}! 👨‍🍳 Recibimos tu pedido en {{restaurant}}. Total: ${{total}} COP. Ya está en preparación y te avisaremos cuando esté listo. {{address}}',
   JSON_ARRAY('nombre', 'restaurant', 'total', 'address')),
  ('casapaella_promocion_generica', 'marketing', 'es',
   '¡Hola {{nombre}}! {{restaurant}} te tiene una promo especial. {{body}}',
   JSON_ARRAY('nombre', 'restaurant', 'body'))
ON DUPLICATE KEY UPDATE `body` = VALUES(`body`);
