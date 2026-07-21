import { DataSource, In, Repository } from 'typeorm';
import { StockEntity, StockEntitySchema } from '../entities/stock.entity.ts';

export type StockInput = {
  symbol: string;
  name?: string;
  exchange?: string;
  investmentAmount?: number | null;
  country?: string | null;
  currency?: string | null;
};

export type StockUpdateResult = {
  updated: StockEntity[];
  missingSymbols: string[];
};

export type StockUpsertResult = {
  inserted: StockEntity[];
  updated: StockEntity[];
};

export class StockRepository {
  private readonly repository: Repository<StockEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(StockEntitySchema);
  }

  findAll(): Promise<StockEntity[]> {
    return this.repository.find({
      order: {
        symbol: 'ASC',
      },
    });
  }

  findBySymbols(symbols: string[]): Promise<StockEntity[]> {
    return this.repository.find({
      where: {
        symbol: In(symbols),
      },
      order: {
        symbol: 'ASC',
      },
    });
  }

  async upsertMany(stocks: StockInput[]): Promise<StockUpsertResult> {
    const inserted: StockEntity[] = [];
    const updated: StockEntity[] = [];

    for (const stock of stocks) {
      const existingStock = await this.repository.findOne({
        where: {
          symbol: stock.symbol,
        },
      });

      if (existingStock) {
        updated.push(
          await this.repository.save({
            ...existingStock,
            ...Object.fromEntries(
              Object.entries(stock).filter(([, value]) => value !== undefined),
            ),
          }),
        );
        continue;
      }

      const entity = this.repository.create(stock);
      inserted.push(await this.repository.save(entity));
    }

    return {
      inserted,
      updated,
    };
  }

  async updateMany(stocks: StockInput[]): Promise<StockUpdateResult> {
    const updated: StockEntity[] = [];
    const missingSymbols: string[] = [];

    for (const stock of stocks) {
      const existingStock = await this.repository.findOne({
        where: {
          symbol: stock.symbol,
        },
      });

      if (!existingStock) {
        missingSymbols.push(stock.symbol);
        continue;
      }

      updated.push(
        await this.repository.save({
          ...existingStock,
          ...Object.fromEntries(
            Object.entries(stock).filter(([, value]) => value !== undefined),
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

  executeSelectQuery<T extends Record<string, unknown>>(query: string): Promise<T[]> {
    return this.repository.query(query);
  }
}
