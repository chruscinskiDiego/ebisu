import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../config.ts';
import { FinancialActionEntitySchema } from './entities/financialAction.entity.ts';
import { CreateFinancialActions1720000000000 } from './migrations/1720000000000-CreateFinancialActions.ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.postgres.host,
  port: config.postgres.port,
  username: config.postgres.username,
  password: config.postgres.password,
  database: config.postgres.database,
  ssl: config.postgres.ssl
    ? {
        rejectUnauthorized: false,
      }
    : false,
  synchronize: config.postgres.synchronize,
  logging: config.postgres.logging,
  migrationsRun: config.postgres.migrationsRun,
  entities: [FinancialActionEntitySchema],
  migrations: [CreateFinancialActions1720000000000],
  subscribers: [],
});

export const initializeDataSource = async (): Promise<DataSource> => {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  return AppDataSource.initialize();
};
