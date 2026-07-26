import { EntitySchema } from "typeorm";

export type CryptoEntity = {
  id: number;
  symbol: string;
  name: string;
  investmentAmount: number | null;
  currency: "USDT" | null;
  createdAt: Date;
  updatedAt: Date;
};

export const CryptoEntitySchema = new EntitySchema<CryptoEntity>({
  name: "Crypto",
  tableName: "cryptos",
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
    investmentAmount: {
      name: "investment_amount",
      type: "double precision",
      nullable: true,
    },
    currency: {
      type: String,
      nullable: true,
    },
    createdAt: {
      name: "created_at",
      type: Date,
      createDate: true,
    },
    updatedAt: {
      name: "updated_at",
      type: Date,
      updateDate: true,
    },
  },
});
