import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { AuthAccount } from '../modules/users/entities/auth-account.entity';
import { User } from '../modules/users/entities/user.entity';
import { UserProfile } from '../modules/users/entities/user-profile.entity';

const SALT_ROUNDS = 10;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const userModel = app.get<typeof User>(getModelToken(User));
    const profileModel = app.get<typeof UserProfile>(getModelToken(UserProfile));
    const accountModel = app.get<typeof AuthAccount>(getModelToken(AuthAccount));

    const email = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD ?? '';
    const name = process.env.ADMIN_NAME?.trim() || email.split('@')[0] || 'Admin';

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di .env');
    }

    const existing = await userModel.findOne({ where: { email } });

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log(`[seed:admin] Role ${email} diubah menjadi admin`);
      } else {
        console.log(`[seed:admin] Admin sudah ada: ${email}`);
      }

      const profile = await profileModel.findOne({ where: { userId: existing.id } });
      if (!profile) {
        await profileModel.create({ userId: existing.id, displayName: name });
        console.log(`[seed:admin] user_profile dibuat untuk ${email}`);
      }

      const account = await accountModel.findOne({
        where: { userId: existing.id, provider: 'local' },
      });
      if (!account) {
        await accountModel.create({
          userId: existing.id,
          provider: 'local',
          providerAccountId: email,
          email,
        });
        console.log(`[seed:admin] auth_account (local) dibuat untuk ${email}`);
      }

      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await userModel.sequelize!.transaction(async (transaction) => {
      const created = await userModel.create(
        { name, email, passwordHash, role: 'admin', isActive: true },
        { transaction },
      );

      await profileModel.create(
        { userId: created.id, displayName: name },
        { transaction },
      );

      await accountModel.create(
        { userId: created.id, provider: 'local', providerAccountId: email, email },
        { transaction },
      );
    });

    console.log(`[seed:admin] Admin dibuat: ${email}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  console.error('[seed:admin] Gagal:', error);
  process.exit(1);
});
