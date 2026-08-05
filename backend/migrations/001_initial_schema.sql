-- ============================================================================
--  Company Events — initial schema
--  Target: MySQL 8.0+ / MariaDB 10.4+  (Hostinger runs MariaDB 11.8)
--
--  Import via phpMyAdmin:
--    hPanel -> Databases -> phpMyAdmin -> select your database
--    -> Import tab -> choose this file -> Go
--
--  Or from a shell:
--    mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < 001_initial_schema.sql
--
--  Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
--  Conventions
--
--  * Primary keys are CHAR(24) holding the original MongoDB ObjectId hex.
--    Keeping the exact ids means existing URLs, bookmarks and API clients keep
--    working, and the migration can be re-run without creating duplicates.
--  * DATETIME(3) preserves the millisecond precision MongoDB stored.
--  * Money is INT UNSIGNED in whole rupees — the application has always treated
--    these as integers, so this is exact and needs no rounding rules.
--  * JSON columns are used only where the value is read and written as a whole
--    document and never queried by inner field.
-- ---------------------------------------------------------------------------


-- ============================ users ========================================
CREATE TABLE IF NOT EXISTS users (
  id                CHAR(24)      NOT NULL,
  name              VARCHAR(120)  NOT NULL,
  email             VARCHAR(190)  NOT NULL,
  phone             VARCHAR(20)   NULL,
  -- bcrypt hashes are 60 characters; 100 leaves room for a future algorithm.
  password          VARCHAR(100)  NOT NULL,
  role              ENUM('admin','staff','customer') NOT NULL DEFAULT 'customer',
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  last_login_at     DATETIME(3)   NULL,
  -- Refresh tokens issued before this instant are rejected. Bumped on password
  -- change and on "log out of all devices".
  tokens_valid_from DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ============================ events =======================================
CREATE TABLE IF NOT EXISTS events (
  id             CHAR(24)      NOT NULL,
  title          VARCHAR(200)  NOT NULL,
  type           VARCHAR(100)  NOT NULL DEFAULT '',
  -- Free text as entered by the admin ("Free", "₹1,499", "500 onwards").
  price          VARCHAR(50)   NOT NULL DEFAULT '',
  -- Parsed numeric value derived from `price`; this is what payments use.
  price_amount   INT UNSIGNED  NOT NULL DEFAULT 0,
  phone          VARCHAR(20)   NOT NULL DEFAULT '',
  location       VARCHAR(300)  NOT NULL DEFAULT '',
  event_date     DATE          NULL,
  start_time     VARCHAR(5)    NOT NULL DEFAULT '',   -- 24h "HH:mm"
  end_time       VARCHAR(5)    NOT NULL DEFAULT '',
  start_time_12h VARCHAR(10)   NOT NULL DEFAULT '',   -- display "7:30 PM"
  end_time_12h   VARCHAR(10)   NOT NULL DEFAULT '',
  description    TEXT          NULL,
  main_image     VARCHAR(2000) NOT NULL,
  status         ENUM('upcoming','live','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  created_by     CHAR(24)      NULL,
  updated_by     CHAR(24)      NULL,
  -- Firebase Realtime Database push key, so pre-migration links still resolve.
  legacy_id      VARCHAR(64)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_events_status_created (status, created_at DESC),
  KEY idx_events_legacy (legacy_id),
  KEY idx_events_title (title),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_events_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ======================== event_extras =====================================
-- Add-ons offered with an event (games, food stalls, DJ sets).
-- `sort_order` exists because the admin's ordering is visible on the event page.
CREATE TABLE IF NOT EXISTS event_extras (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    CHAR(24)        NOT NULL,
  -- Stable key the booking flow references when selecting add-ons.
  extra_key   VARCHAR(64)     NOT NULL,
  category    ENUM('game','food','music','other') NOT NULL DEFAULT 'other',
  name        VARCHAR(200)    NOT NULL DEFAULT '',
  description VARCHAR(1000)   NOT NULL DEFAULT '',
  price       VARCHAR(50)     NOT NULL DEFAULT '',
  image_url   VARCHAR(2000)   NOT NULL DEFAULT '',
  sort_order  INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_extra_key (event_id, extra_key),
  KEY idx_event_extras_order (event_id, sort_order),
  CONSTRAINT fk_event_extras_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- =========================== bookings ======================================
CREATE TABLE IF NOT EXISTS bookings (
  id               CHAR(24)     NOT NULL,
  -- Short human-facing code printed on receipts, e.g. BKG-7K3P2Q.
  reference        VARCHAR(32)  NOT NULL,
  event_id         CHAR(24)     NOT NULL,
  -- Denormalised: a receipt must still read correctly if the event is renamed.
  event_title      VARCHAR(200) NOT NULL,
  user_id          CHAR(24)     NULL,
  customer_name    VARCHAR(120) NOT NULL DEFAULT '',
  customer_email   VARCHAR(190) NOT NULL DEFAULT '',
  customer_phone   VARCHAR(30)  NOT NULL DEFAULT '',
  quantity         SMALLINT UNSIGNED NOT NULL,
  -- All amounts are whole rupees, frozen at the time of booking so a later
  -- price change cannot alter what the customer was charged.
  base_price       INT UNSIGNED NOT NULL DEFAULT 0,
  extras_price     INT UNSIGNED NOT NULL DEFAULT 0,
  price_per_ticket INT UNSIGNED NOT NULL DEFAULT 0,
  total_amount     INT UNSIGNED NOT NULL DEFAULT 0,
  currency         CHAR(3)      NOT NULL DEFAULT 'INR',
  status           ENUM('pending','confirmed','cancelled','refunded','failed') NOT NULL DEFAULT 'pending',
  payment_method   ENUM('razorpay','free') NOT NULL DEFAULT 'razorpay',
  confirmed_at     DATETIME(3)  NULL,
  cancelled_at     DATETIME(3)  NULL,
  notes            TEXT         NULL,
  legacy_id        VARCHAR(64)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_reference (reference),
  KEY idx_bookings_event (event_id),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_status_created (status, created_at DESC),
  KEY idx_bookings_customer_email (customer_email, created_at DESC),
  KEY idx_bookings_created (created_at DESC),
  -- RESTRICT, not CASCADE: deleting an event must never silently destroy the
  -- record of money someone paid. The application blocks or reassigns first.
  CONSTRAINT fk_bookings_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ======================= booking_extras ====================================
-- Add-ons actually purchased, with the unit price captured at booking time.
CREATE TABLE IF NOT EXISTS booking_extras (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id CHAR(24)        NOT NULL,
  extra_key  VARCHAR(64)     NOT NULL,
  name       VARCHAR(200)    NOT NULL DEFAULT '',
  category   VARCHAR(40)     NOT NULL DEFAULT 'other',
  unit_price INT UNSIGNED    NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_booking_extras_booking (booking_id, sort_order),
  CONSTRAINT fk_booking_extras_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- =========================== payments ======================================
-- One payment per booking. `payments.booking_id` owns the relationship; the
-- booking's payment is reached by JOIN. Storing a payment_id on bookings as
-- well would make the two tables mutually dependent and neither could be
-- inserted first.
CREATE TABLE IF NOT EXISTS payments (
  id                  CHAR(24)     NOT NULL,
  booking_id          CHAR(24)     NOT NULL,
  event_id            CHAR(24)     NULL,
  user_id             CHAR(24)     NULL,
  provider            VARCHAR(40)  NOT NULL DEFAULT 'razorpay',
  razorpay_order_id   VARCHAR(64)  NOT NULL,
  razorpay_payment_id VARCHAR(64)  NULL,
  -- Stored for audit only. Verification happens in the service layer before
  -- anything is marked paid, and this column is never returned by the API.
  razorpay_signature  VARCHAR(256) NULL,
  amount              INT UNSIGNED NOT NULL DEFAULT 0,
  amount_refunded     INT UNSIGNED NOT NULL DEFAULT 0,
  currency            CHAR(3)      NOT NULL DEFAULT 'INR',
  status              ENUM('created','authorized','paid','failed','refunded','partially_refunded')
                        NOT NULL DEFAULT 'created',
  method              VARCHAR(40)  NOT NULL DEFAULT '',
  receipt_number      VARCHAR(64)  NULL,
  failure_reason      VARCHAR(500) NOT NULL DEFAULT '',
  -- Raw gateway payload kept for reconciliation; never returned by the API.
  provider_response   JSON         NULL,
  paid_at             DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order (razorpay_order_id),
  UNIQUE KEY uq_payments_booking (booking_id),
  KEY idx_payments_payment_id (razorpay_payment_id),
  KEY idx_payments_receipt (receipt_number),
  KEY idx_payments_status (status),
  KEY idx_payments_created (created_at DESC),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payments_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ======================== payment_refunds ==================================
CREATE TABLE IF NOT EXISTS payment_refunds (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id         CHAR(24)        NOT NULL,
  razorpay_refund_id VARCHAR(64)     NOT NULL,
  amount             INT UNSIGNED    NOT NULL DEFAULT 0,
  reason             VARCHAR(200)    NOT NULL DEFAULT '',
  created_by         CHAR(24)        NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_refunds_payment (payment_id),
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_refunds_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ======================= contact_messages ==================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id                CHAR(24)     NOT NULL,
  name              VARCHAR(120) NOT NULL,
  phone             VARCHAR(30)  NOT NULL,
  email             VARCHAR(190) NOT NULL DEFAULT '',
  event_name        VARCHAR(200) NOT NULL,
  members           VARCHAR(50)  NOT NULL DEFAULT '',
  message           TEXT         NULL,
  status            ENUM('new','in_progress','closed') NOT NULL DEFAULT 'new',
  admin_notified    TINYINT(1)   NOT NULL DEFAULT 0,
  customer_notified TINYINT(1)   NOT NULL DEFAULT 0,
  -- Retained for abuse investigation only; never returned by the API.
  ip_address        VARCHAR(45)  NOT NULL DEFAULT '',
  user_agent        VARCHAR(300) NOT NULL DEFAULT '',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_contact_status_created (status, created_at DESC),
  KEY idx_contact_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ========================== file_assets ====================================
CREATE TABLE IF NOT EXISTS file_assets (
  id            CHAR(24)     NOT NULL,
  -- Driver-relative location: a path on disk, or an object key in a bucket.
  storage_key   VARCHAR(2000) NOT NULL,
  driver        ENUM('local','s3') NOT NULL DEFAULT 'local',
  original_name VARCHAR(200) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size          INT UNSIGNED NOT NULL DEFAULT 0,
  folder        VARCHAR(40)  NOT NULL DEFAULT 'general',
  uploaded_by   CHAR(24)     NULL,
  checksum      CHAR(64)     NOT NULL DEFAULT '',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_file_assets_key (storage_key),
  KEY idx_file_assets_folder (folder),
  KEY idx_file_assets_created (created_at DESC),
  CONSTRAINT fk_file_assets_user FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ========================= refresh_tokens ==================================
-- Only the SHA-256 digest of each token is stored, so a database leak cannot be
-- replayed as a session. Rotation plus `replaced_by` gives reuse detection.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          CHAR(24)     NOT NULL,
  user_id     CHAR(24)     NOT NULL,
  token_id    CHAR(36)     NOT NULL,   -- jti (uuid)
  token_hash  CHAR(64)     NOT NULL,   -- sha256 hex
  expires_at  DATETIME(3)  NOT NULL,
  revoked_at  DATETIME(3)  NULL,
  replaced_by CHAR(36)     NULL,       -- jti of the successor token
  user_agent  VARCHAR(300) NOT NULL DEFAULT '',
  ip_address  VARCHAR(45)  NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_id (token_id),
  KEY idx_refresh_user (user_id),
  -- Drives the expiry sweep that replaces MongoDB's TTL index.
  KEY idx_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ========================== activity_logs ==================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          CHAR(24)     NOT NULL,
  actor_id    CHAR(24)     NULL,
  actor_email VARCHAR(190) NOT NULL DEFAULT '',
  action      VARCHAR(80)  NOT NULL,
  entity_type VARCHAR(60)  NOT NULL DEFAULT '',
  entity_id   VARCHAR(64)  NOT NULL DEFAULT '',
  metadata    JSON         NULL,
  ip_address  VARCHAR(45)  NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_activity_action (action),
  KEY idx_activity_created (created_at DESC),
  KEY idx_activity_actor (actor_id),
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ========================== home_contents ==================================
-- Singleton (setting_key = 'mainContent'). The nested blocks stay as JSON
-- because they are always read and written as a whole document — splitting
-- them into tables would add joins without enabling any query we need.
CREATE TABLE IF NOT EXISTS home_contents (
  id              CHAR(24)      NOT NULL,
  setting_key     VARCHAR(40)   NOT NULL DEFAULT 'mainContent',
  hero_slides     JSON          NULL,   -- array of image paths
  gallery_images  JSON          NULL,   -- array of image paths
  pricing_image   VARCHAR(2000) NOT NULL DEFAULT '',
  promotion_image VARCHAR(2000) NOT NULL DEFAULT '',
  about_text      TEXT          NULL,
  extra_sections  JSON          NULL,   -- [{ key, label, imageURL }]
  story_section   JSON          NULL,   -- { title, description1, description2, image1, image2 }
  updated_by      CHAR(24)      NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_key (setting_key),
  CONSTRAINT fk_home_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ========================== site_settings ==================================
-- Singleton (setting_key = 'site'). Branding and contact details, edited from
-- the admin panel.
CREATE TABLE IF NOT EXISTS site_settings (
  id           CHAR(24)      NOT NULL,
  setting_key  VARCHAR(40)   NOT NULL DEFAULT 'site',
  company_name VARCHAR(120)  NOT NULL DEFAULT '',
  tagline      VARCHAR(300)  NOT NULL DEFAULT '',
  logo         VARCHAR(2000) NOT NULL DEFAULT '',
  favicon      VARCHAR(2000) NOT NULL DEFAULT '',
  contact      JSON          NULL,   -- { phone, whatsappNumber, whatsappMessage, email, address }
  social_links JSON          NULL,   -- [{ platform, url }]
  footer       JSON          NULL,   -- { description, copyrightText }
  about        JSON          NULL,   -- { heading, subheading, body, image, services[], features[] }
  updated_by   CHAR(24)      NULL,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_site_key (setting_key),
  CONSTRAINT fk_site_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;


-- ============================================================================
--  Expired refresh token sweep
--
--  MongoDB removed these automatically via a TTL index. SQL has no equivalent,
--  so an event does the same job. Shared hosting often has the event scheduler
--  disabled and does not grant the EVENT privilege, so the application also
--  sweeps on an interval — whichever is available will keep the table tidy, and
--  running both is harmless.
--
--  Check whether it is enabled:   SHOW VARIABLES LIKE 'event_scheduler';
--  If this statement errors with a privilege error, ignore it — the
--  application-level sweep covers it.
-- ============================================================================
CREATE EVENT IF NOT EXISTS ev_purge_expired_refresh_tokens
  ON SCHEDULE EVERY 1 HOUR
  DO
    DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
        OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL 30 DAY);
