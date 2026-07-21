import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndStocks1720000001000 implements MigrationInterface {
  name = 'CreateUsersAndStocks1720000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR,
        type VARCHAR,
        investment_horizon VARCHAR,
        investment_strategy VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.financial_actions') IS NOT NULL
          AND to_regclass('public.stocks') IS NULL THEN
          ALTER TABLE financial_actions RENAME TO stocks;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR,
        name VARCHAR,
        exchange VARCHAR,
        investment_amount DOUBLE PRECISION,
        country VARCHAR,
        currency VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stocks' AND column_name = 'marketShare'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'stocks' AND column_name = 'investment_amount'
          ) THEN
            ALTER TABLE stocks RENAME COLUMN "marketShare" TO investment_amount;
          ELSE
            UPDATE stocks
            SET investment_amount = "marketShare"
            WHERE investment_amount IS NULL;

            ALTER TABLE stocks DROP COLUMN "marketShare";
          END IF;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stocks' AND column_name = 'createdAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stocks' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE stocks RENAME COLUMN "createdAt" TO created_at;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stocks' AND column_name = 'updatedAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'stocks' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE stocks RENAME COLUMN "updatedAt" TO updated_at;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE stocks
        ADD COLUMN IF NOT EXISTS symbol VARCHAR,
        ADD COLUMN IF NOT EXISTS exchange VARCHAR,
        ADD COLUMN IF NOT EXISTS investment_amount DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS country VARCHAR,
        ADD COLUMN IF NOT EXISTS currency VARCHAR,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      UPDATE stocks
      SET symbol = upper(name)
      WHERE symbol IS NULL AND name IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE stocks
      SET exchange = 'UNKNOWN'
      WHERE exchange IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE stocks
        ALTER COLUMN symbol SET NOT NULL,
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN exchange SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_STOCKS_SYMBOL ON stocks (symbol)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS stocks');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}
