-- AlterTable payment_records: Thêm enum EXPIRED cho status
ALTER TABLE `payment_records` MODIFY `status` ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED') NOT NULL DEFAULT 'PENDING';

-- CreateTable payment_transactions
CREATE TABLE `payment_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `paymentRecordId` VARCHAR(191) NULL,
    `provider` VARCHAR(50) NOT NULL,
    `method` ENUM('COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO', 'DEBT_PERIOD') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `transactionId` VARCHAR(100) NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `rawRequest` LONGTEXT NULL,
    `rawResponse` LONGTEXT NULL,
    `errorMessage` TEXT NULL,
    `paidAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_transactions_orderId_idx`(`orderId`),
    INDEX `payment_transactions_transactionId_idx`(`transactionId`),
    INDEX `payment_transactions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_paymentRecordId_fkey` FOREIGN KEY (`paymentRecordId`) REFERENCES `payment_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
