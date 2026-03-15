import * as dotenv from 'dotenv';
import { AppDataSource } from '../data-source';

dotenv.config();

type ResetOptions = {
  force: boolean;
  allowProduction: boolean;
};

function parseOptions(argv: string[]): ResetOptions {
  const args = new Set(argv);

  return {
    force: args.has('--force'),
    allowProduction: args.has('--allow-production'),
  };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (!options.force) {
    throw new Error('Missing --force flag. Example: pnpm run db:reset -- --force');
  }

  if (process.env.NODE_ENV === 'production' && !options.allowProduction) {
    throw new Error(
      'Refusing to reset database in production. Use --allow-production only if you are absolutely sure.',
    );
  }

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const rows = await queryRunner.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('migrations', 'typeorm_metadata')
        ORDER BY tablename ASC
      `,
    );

    const tableNames: string[] = rows.map((row: { tablename: string }) => row.tablename);

    if (tableNames.length === 0) {
      console.log('No tables found to truncate.');
      await queryRunner.commitTransaction();
      return;
    }

    const qualifiedTables = tableNames.map(
      (tableName) => `${quoteIdentifier('public')}.${quoteIdentifier(tableName)}`,
    );

    const truncateSql = `TRUNCATE TABLE ${qualifiedTables.join(', ')} RESTART IDENTITY CASCADE`;
    await queryRunner.query(truncateSql);

    await queryRunner.commitTransaction();
    console.log(`Database reset completed. Truncated ${tableNames.length} tables.`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Database reset failed:', error);
  process.exit(1);
});

