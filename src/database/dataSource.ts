import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../config.ts';
import { StockEntitySchema } from './entities/stock.entity.ts';
import { CryptoEntitySchema } from './entities/crypto.entity.ts';
import { UserEntitySchema } from './entities/user.entity.ts';
import { CreateUsersAndStocks1720000001000 } from './migrations/1720000001000-CreateUsersAndStocks.ts';
import { CreateCryptos1720000002000 } from './migrations/1720000002000-CreateCryptos.ts';

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
  entities: [StockEntitySchema, CryptoEntitySchema, UserEntitySchema],
  migrations: [CreateUsersAndStocks1720000001000, CreateCryptos1720000002000],
  subscribers: [],
});

export const initializeDataSource = async (): Promise<DataSource> => {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  return AppDataSource.initialize();
};
