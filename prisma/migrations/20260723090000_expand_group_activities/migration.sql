ALTER TABLE `group_activities`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `end_at` DATETIME(3) NULL,
  ADD COLUMN `venue_name` VARCHAR(200) NULL,
  ADD COLUMN `latitude` DECIMAL(9, 6) NULL,
  ADD COLUMN `longitude` DECIMAL(9, 6) NULL,
  ADD COLUMN `environment` ENUM('INDOOR', 'COVERED_OUTDOOR', 'OUTDOOR') NULL,
  ADD COLUMN `surface` VARCHAR(100) NULL,
  ADD COLUMN `responsibility_deadline` DATETIME(3) NULL,
  ADD COLUMN `archived_at` DATETIME(3) NULL;

CREATE INDEX `group_activities_group_id_status_date_idx`
  ON `group_activities`(`group_id`, `status`, `date`);

CREATE INDEX `group_activities_group_id_venue_name_idx`
  ON `group_activities`(`group_id`, `venue_name`);
