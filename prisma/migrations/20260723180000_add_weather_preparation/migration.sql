-- CreateTable
CREATE TABLE `weather_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `activity_id` VARCHAR(191) NOT NULL,
    `forecast_time` DATETIME(3) NOT NULL,
    `temperature` DOUBLE NOT NULL,
    `apparent_temperature` DOUBLE NOT NULL,
    `precipitation` DOUBLE NOT NULL,
    `wind_speed` DOUBLE NOT NULL,
    `uv_index` DOUBLE NOT NULL,
    `source` VARCHAR(100) NOT NULL DEFAULT 'Open-Meteo',
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fingerprint` VARCHAR(64) NOT NULL,
    `raw` JSON NULL,

    INDEX `weather_snapshots_activity_id_fetched_at_idx`(`activity_id`, `fetched_at`),
    UNIQUE INDEX `weather_snapshots_activity_id_fingerprint_key`(`activity_id`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weather_suggestions` (
    `id` VARCHAR(191) NOT NULL,
    `activity_id` VARCHAR(191) NOT NULL,
    `snapshot_id` VARCHAR(191) NOT NULL,
    `rule_key` VARCHAR(100) NOT NULL,
    `item_name` VARCHAR(200) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `target` ENUM('PERSONAL', 'SHARED') NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `accepted_item_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `weather_suggestions_activity_id_status_idx`(`activity_id`, `status`),
    UNIQUE INDEX `weather_suggestions_activity_id_rule_key_snapshot_id_key`(`activity_id`, `rule_key`, `snapshot_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_weather_rule_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `rule_key` VARCHAR(100) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `team_weather_rule_preferences_group_id_rule_key_key`(`group_id`, `rule_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `weather_snapshots` ADD CONSTRAINT `weather_snapshots_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weather_suggestions` ADD CONSTRAINT `weather_suggestions_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weather_suggestions` ADD CONSTRAINT `weather_suggestions_snapshot_id_fkey` FOREIGN KEY (`snapshot_id`) REFERENCES `weather_snapshots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weather_suggestions` ADD CONSTRAINT `weather_suggestions_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_weather_rule_preferences` ADD CONSTRAINT `team_weather_rule_preferences_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
