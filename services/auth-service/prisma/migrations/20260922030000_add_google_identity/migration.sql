-- Google-only accounts do not have a local password. Existing password hashes are preserved.
ALTER TABLE `users` MODIFY `passwordHash` VARCHAR(255) NULL;

CREATE TABLE `external_identities` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` ENUM('GOOGLE') NOT NULL,
    `providerSubject` VARCHAR(255) NOT NULL,
    `providerEmail` VARCHAR(255) NOT NULL,
    `displayName` VARCHAR(100) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `external_identities_provider_providerSubject_key`(`provider`, `providerSubject`),
    INDEX `external_identities_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `external_identities`
    ADD CONSTRAINT `external_identities_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
