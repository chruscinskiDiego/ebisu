import { EntitySchema } from 'typeorm';

export type FinancialActionEntity = {
  id: number;
  name: string;
  marketShare: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export const FinancialActionEntitySchema = new EntitySchema<FinancialActionEntity>({
  name: 'FinancialAction',
  tableName: 'financial_actions',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    name: {
      type: String,
      unique: true,
    },
    marketShare: {
      type: 'double precision',
      nullable: true,
    },
    createdAt: {
      type: Date,
      createDate: true,
    },
    updatedAt: {
      type: Date,
      updateDate: true,
    },
  },
});
