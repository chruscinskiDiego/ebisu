import { EntitySchema } from 'typeorm';

export const UserTypeValues = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'PROFESSIONAL',
] as const;

export const InvestmentHorizonValues = [
  'SHORT_TERM',
  'MEDIUM_TERM',
  'LONG_TERM',
] as const;

export const InvestmentStrategyValues = [
  'VALUE',
  'GROWTH',
  'DIVIDEND',
  'QUALITY',
  'MOMENTUM',
  'PASSIVE',
  'SPECULATIVE',
] as const;

export type UserType = (typeof UserTypeValues)[number];
export type InvestmentHorizon = (typeof InvestmentHorizonValues)[number];
export type InvestmentStrategy = (typeof InvestmentStrategyValues)[number];

export type UserEntity = {
  id: number;
  name: string | null;
  type: UserType | null;
  investmentHorizon: InvestmentHorizon | null;
  investmentStrategy: InvestmentStrategy | null;
  createdAt: Date;
  updatedAt: Date;
};

export const UserEntitySchema = new EntitySchema<UserEntity>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true,
    },
    name: {
      type: String,
      nullable: true,
    },
    type: {
      type: String,
      nullable: true,
    },
    investmentHorizon: {
      name: 'investment_horizon',
      type: String,
      nullable: true,
    },
    investmentStrategy: {
      name: 'investment_strategy',
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
