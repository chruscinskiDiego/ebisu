import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinancialActions1720000000000 implements MigrationInterface {
  name = 'CreateFinancialActions1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS financial_actions (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL UNIQUE,
        "marketShare" DOUBLE PRECISION,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS financial_actions');
  }
}
