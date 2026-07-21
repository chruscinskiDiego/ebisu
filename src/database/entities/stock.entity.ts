import { EntitySchema } from 'typeorm';

export type StockEntity = {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  investmentAmount: number | null;
  country: string | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const StockEntitySchema = new EntitySchema<StockEntity>({
  name: 'Stock',
  tableName: 'stocks',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    symbol: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
    },
    exchange: {
      type: String,
    },
    investmentAmount: {
      name: 'investment_amount',
      type: 'double precision',
      nullable: true,
    },
    country: {
      type: String,
      nullable: true,
    },
    currency: {
      type: String,
      nullable: true,
    },
    createdAt: {
      name: 'created_at',
      type: Date,
      createDate: true,
    },
    updatedAt: {
      name: 'updated_at',
      type: Date,
      updateDate: true,
    },
  },
});
