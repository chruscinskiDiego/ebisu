import { DataSource, In, Repository } from 'typeorm';
import {
  FinancialActionEntity,
  FinancialActionEntitySchema,
} from '../entities/financialAction.entity.ts';

export type FinancialActionInput = {
  name: string;
  marketShare: number | null;
};

export type FinancialActionUpdateResult = {
  updated: FinancialActionEntity[];
  missingNames: string[];
};

export class FinancialActionRepository {
  private readonly repository: Repository<FinancialActionEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(FinancialActionEntitySchema);
  }

  findAll(): Promise<FinancialActionEntity[]> {
    return this.repository.find({
      order: {
        name: 'ASC',
      },
    });
  }

  findByNames(names: string[]): Promise<FinancialActionEntity[]> {
    return this.repository.find({
      where: {
        name: In(names),
      },
      order: {
        name: 'ASC',
      },
    });
  }

  async insertMany(actions: FinancialActionInput[]): Promise<FinancialActionEntity[]> {
    const entities = this.repository.create(actions);
    return this.repository.save(entities);
  }

  async updateMany(actions: FinancialActionInput[]): Promise<FinancialActionUpdateResult> {
    const updated: FinancialActionEntity[] = [];
    const missingNames: string[] = [];

    for (const action of actions) {
      const existingAction = await this.repository.findOne({
        where: {
          name: action.name,
        },
      });

      if (!existingAction) {
        missingNames.push(action.name);
        continue;
      }

      updated.push(
        await this.repository.save({
          ...existingAction,
          marketShare: action.marketShare,
        }),
      );
    }

    return {
      updated,
      missingNames,
    };
  }

  async deleteByNames(names: string[]): Promise<number> {
    const deleteResult = await this.repository.delete({
      name: In(names),
    });

    return deleteResult.affected ?? 0;
  }

  executeSelectQuery<T extends Record<string, unknown>>(query: string): Promise<T[]> {
    return this.repository.query(query);
  }
}
