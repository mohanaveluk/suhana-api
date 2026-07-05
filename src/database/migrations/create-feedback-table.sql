-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create_feedback_table
-- Table   : feedback
-- Created : 2026-07-01
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `feedback` (
  -- Primary key & GUID
  `id`                       VARCHAR(36)   NOT NULL,
  `guid`                     VARCHAR(36)   NOT NULL,

  -- Core
  `feedback_type`            ENUM('GENERAL','PROFILE') NOT NULL,
  `category`                 ENUM(
    'BUG_REPORT','FEATURE_REQUEST','CUSTOMER_SUPPORT','COMPLAINT','SUGGESTION',
    'WEBSITE_EXPERIENCE','BILLING','MOBILE_EXPERIENCE','AI_MATCHMAKING',
    'SUCCESS_STORY','PROFILE_POSITIVE','PROFILE_NEGATIVE','PROFILE_REPORT'
  ) NOT NULL,
  `rating`                   TINYINT UNSIGNED NULL CHECK (`rating` BETWEEN 1 AND 5),
  `subject`                  VARCHAR(300)  NOT NULL,
  `message`                  TEXT          NOT NULL,

  -- Submitter
  `submitted_by_user_id`     VARCHAR(36)   NULL,
  `submitted_by_profile_id`  VARCHAR(36)   NULL,

  -- Target (profile feedback only)
  `target_user_id`           VARCHAR(36)   NULL,
  `target_profile_id`        VARCHAR(36)   NULL,

  -- Status & visibility
  `status`                   ENUM('PENDING','APPROVED','REJECTED','RESOLVED') NOT NULL DEFAULT 'PENDING',
  `is_anonymous`             TINYINT(1)    NOT NULL DEFAULT 0,
  `is_public`                TINYINT(1)    NOT NULL DEFAULT 0,
  `priority`                 ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',

  -- Admin
  `admin_notes`              TEXT          NULL,
  `resolved_by`              VARCHAR(36)   NULL,
  `resolved_at`              DATETIME      NULL,

  -- Reply
  `reply_message`            TEXT          NULL,
  `replied_by_user_id`       VARCHAR(36)   NULL,
  `replied_at`               DATETIME      NULL,

  -- Device / context
  `device_type`              VARCHAR(50)   NULL,
  `browser`                  VARCHAR(100)  NULL,
  `os_version`               VARCHAR(100)  NULL,
  `ip_address`               VARCHAR(45)   NULL,
  `country`                  VARCHAR(100)  NULL,
  `city`                     VARCHAR(100)  NULL,
  `attachment_url`           VARCHAR(500)  NULL,

  -- Soft delete
  `is_deleted`               TINYINT(1)    NOT NULL DEFAULT 0,
  `deleted_at`               DATETIME      NULL,

  -- Audit
  `created_by`               VARCHAR(36)   NULL,
  `updated_by`               VARCHAR(36)   NULL,
  `created_at`               DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`               DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_FEEDBACK_GUID` (`guid`),

  -- Query indexes
  INDEX `IDX_FEEDBACK_SUBMITTED_BY`   (`submitted_by_user_id`),
  INDEX `IDX_FEEDBACK_TARGET_USER`    (`target_user_id`),
  INDEX `IDX_FEEDBACK_STATUS_TYPE`    (`status`, `feedback_type`),
  INDEX `IDX_FEEDBACK_TARGET_PROFILE` (`target_profile_id`, `status`, `is_public`),
  INDEX `IDX_FEEDBACK_CREATED_AT`     (`created_at`),

  CONSTRAINT `FK_FEEDBACK_SUBMITTED_USER`
    FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_FEEDBACK_TARGET_USER`
    FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
