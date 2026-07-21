-- AlterTable: Add token column (nullable first to handle existing rows)
ALTER TABLE `group_invitations` ADD COLUMN `token` VARCHAR(128) NULL;

-- Backfill existing rows with a placeholder derived from their id
UPDATE `group_invitations` SET `token` = CONCAT('legacy_', id) WHERE `token` IS NULL;

-- Now make it NOT NULL
ALTER TABLE `group_invitations` MODIFY COLUMN `token` VARCHAR(128) NOT NULL;
