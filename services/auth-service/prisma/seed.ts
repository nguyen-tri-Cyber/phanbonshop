/**
 * ====================================================================
 * SEED SCRIPT DÀNH RIÊNG CHO MÔI TRƯỜNG PHÁT TRIỂN (DEVELOPMENT ONLY)
 * TUYỆT ĐỐI KHÔNG SỬ DỤNG TRÊN MÔI TRƯỜNG PRODUCTION!
 * ====================================================================
 */

import { PrismaClient, Role, UserStatus } from '../generated/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.AUTH_DATABASE_URL ||
        'mysql://phanbon_user:phanbon_secret@localhost:3307/auth_db',
    },
  },
});

async function main(): Promise<void> {
  // BẢO VỆ AN TOÀN TUYỆT ĐỐI CHO PRODUCTION: Từ chối chạy seed trên production!
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY FATAL] Refusing to seed database in PRODUCTION environment! Database seeding is strictly for development and testing.',
    );
  }

  console.log('--- [DEV ONLY] Bắt đầu khởi tạo dữ liệu mẫu cho auth_db ---');

  const devPasswordPlain = process.env.DEV_SEED_PASSWORD || 'Dev@Test123456';
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(devPasswordPlain, salt);

  const usersToSeed = [
    {
      email: 'admin@local.test',
      fullName: 'Quản Trị Viên Hệ Thống (DEV)',
      phone: '0900000001',
      role: Role.SUPER_ADMIN,
    },
    {
      email: 'manager@local.test',
      fullName: 'Quản Trị Viên Shop (DEV)',
      phone: '0900000002',
      role: Role.ADMIN,
    },
    {
      email: 'staff@local.test',
      fullName: 'Nhân Viên Bán Hàng (DEV)',
      phone: '0900000003',
      role: Role.STAFF,
    },
    {
      email: 'customer@local.test',
      fullName: 'Khách Hàng Thân Thiết (DEV)',
      phone: '0900000004',
      role: Role.CUSTOMER,
    },
  ];

  for (const u of usersToSeed) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: u.email },
          { phone: u.phone },
        ],
      },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: u.email,
          phone: u.phone,
          passwordHash,
          fullName: u.fullName,
          role: u.role,
          status: UserStatus.ACTIVE,
        },
      });
      console.log(`[DEV ONLY] Đã cập nhật tài khoản: ${u.email} (Role: ${u.role})`);
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`[DEV ONLY] Đã tạo mới tài khoản: ${u.email} / ${devPasswordPlain} (Role: ${u.role})`);
    }
  }

  console.log('--- [DEV ONLY] Hoàn tất khởi tạo dữ liệu mẫu auth_db ---');
}

main()
  .catch((e) => {
    console.error('[DEV SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
