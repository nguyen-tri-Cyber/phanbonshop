import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/client/index.js';
import { createLogger } from '@phanbonshop/logger';

const logger = createLogger('inventory-service:prisma');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url:
            process.env.INVENTORY_DATABASE_URL ||
            'mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db',
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      logger.info('Kết nối tới MySQL inventory_db thành công');
    } catch (error) {
      logger.error('Lỗi kết nối tới MySQL inventory_db', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    logger.info('Đã ngắt kết nối tới MySQL inventory_db');
  }
}
