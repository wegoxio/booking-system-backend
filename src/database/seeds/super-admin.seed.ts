import * as dotenv from 'dotenv';
dotenv.config();

import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { User } from '../../users/entities/user.entity';

async function main() {
  const name = process.env.SUPERADMIN_NAME;
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Missing SUPERADMIN_NAME / SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in .env');
  }

  await AppDataSource.initialize();

  const usersRepo = AppDataSource.getRepository(User);

  // 1) Si ya existe, lo actualizamos (idempotente)
  const existing = await usersRepo.findOne({ where: { email } });

  const password_hash = await argon2.hash(password);

  if (existing) {
    existing.name = name;
    existing.role = 'SUPER_ADMIN';
    existing.tenant_id = null;
    existing.is_active = true;
    existing.password_hash = password_hash;

    await usersRepo.save(existing);
    console.log(`✅ SUPER_ADMIN updated: ${email}`);
  } else {
    const user = usersRepo.create({
      name,
      email,
      password_hash,
      role: 'SUPER_ADMIN',
      tenant_id: null,
      is_active: true,
    });

    await usersRepo.save(user);
    console.log(`✅ SUPER_ADMIN created: ${email}`);
  }

  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try {
    await AppDataSource.destroy();
  } catch {}
  process.exit(1);
});