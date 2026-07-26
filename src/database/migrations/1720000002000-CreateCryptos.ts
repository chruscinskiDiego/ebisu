import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCryptos1720000002000 implements MigrationInterface {
  name = "CreateCryptos1720000002000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cryptos (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        investment_amount DOUBLE PRECISION,
        currency VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_CRYPTOS_SYMBOL ON cryptos (symbol)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS cryptos");
  }
}
