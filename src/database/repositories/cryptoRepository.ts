import { DataSource, In, Repository } from "typeorm";
import { CryptoEntity, CryptoEntitySchema } from "../entities/crypto.entity.ts";

export type CryptoInput = {
  symbol: string;
  name?: string;
  investmentAmount?: number | null;
  currency?: "USDT" | null;
};

export type CryptoUpdateResult = {
  updated: CryptoEntity[];
  missingSymbols: string[];
};

export type CryptoUpsertResult = {
  inserted: CryptoEntity[];
  updated: CryptoEntity[];
};

export class CryptoRepository {
  private readonly repository: Repository<CryptoEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(CryptoEntitySchema);
  }

  findAll(): Promise<CryptoEntity[]> {
    return this.repository.find({
      order: {
        symbol: "ASC",
      },
    });
  }

  findBySymbols(symbols: string[]): Promise<CryptoEntity[]> {
    return this.repository.find({
      where: {
        symbol: In(symbols),
      },
      order: {
        symbol: "ASC",
      },
    });
  }

  async upsertMany(cryptos: CryptoInput[]): Promise<CryptoUpsertResult> {
    const inserted: CryptoEntity[] = [];
    const updated: CryptoEntity[] = [];

    for (const crypto of cryptos) {
      const existingCrypto = await this.repository.findOne({
        where: {
          symbol: crypto.symbol,
        },
      });

      if (existingCrypto) {
        updated.push(
          await this.repository.save({
            ...existingCrypto,
            ...Object.fromEntries(
              Object.entries(crypto).filter(([, value]) => value !== undefined),
            ),
          }),
        );
        continue;
      }

      const entity = this.repository.create(crypto);
      inserted.push(await this.repository.save(entity));
    }

    return {
      inserted,
      updated,
    };
  }

  async updateMany(cryptos: CryptoInput[]): Promise<CryptoUpdateResult> {
    const updated: CryptoEntity[] = [];
    const missingSymbols: string[] = [];

    for (const crypto of cryptos) {
      const existingCrypto = await this.repository.findOne({
        where: {
          symbol: crypto.symbol,
        },
      });

      if (!existingCrypto) {
        missingSymbols.push(crypto.symbol);
        continue;
      }

      updated.push(
        await this.repository.save({
          ...existingCrypto,
          ...Object.fromEntries(
            Object.entries(crypto).filter(([, value]) => value !== undefined),
          ),
        }),
      );
    }

    return {
      updated,
      missingSymbols,
    };
  }

  async deleteBySymbols(symbols: string[]): Promise<number> {
    const deleteResult = await this.repository.delete({
      symbol: In(symbols),
    });

    return deleteResult.affected ?? 0;
  }

  executeSelectQuery<T extends Record<string, unknown>>(
    query: string,
  ): Promise<T[]> {
    return this.repository.query(query);
  }
}
