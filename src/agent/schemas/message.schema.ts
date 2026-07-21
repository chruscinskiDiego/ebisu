import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import { z } from 'zod/v3';

export const IntentionSchema = z.enum([
    'stockDatabaseExecution',
    'userDatabaseExecution',
    'realTimeMarketShare',
    'unknown',
]);

export type Intention = z.infer<typeof IntentionSchema>;

export const DatabaseExecutionTypeSchema = z.enum(['select', 'insert', 'update', 'delete']);

export const StockSchema = z.object({
    symbol: z.string().nullable(),
    name: z.string().nullable(),
    exchange: z.string().nullable(),
    investmentAmount: z.number().nullable(),
    country: z.string().nullable(),
    currency: z.string().nullable(),
});

export type DatabaseExecutionType = z.infer<typeof DatabaseExecutionTypeSchema>;
export type Stock = z.infer<typeof StockSchema>;

export const UserTypeSchema = z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED',
    'PROFESSIONAL',
]);

export const InvestmentHorizonSchema = z.enum([
    'SHORT_TERM',
    'MEDIUM_TERM',
    'LONG_TERM',
]);

export const InvestmentStrategySchema = z.enum([
    'VALUE',
    'GROWTH',
    'DIVIDEND',
    'QUALITY',
    'MOMENTUM',
    'PASSIVE',
    'SPECULATIVE',
]);

export const UserProfileUpdateSchema = z.object({
    name: z.string().nullable().optional(),
    type: UserTypeSchema.nullable().optional(),
    investmentHorizon: InvestmentHorizonSchema.nullable().optional(),
    investmentStrategy: InvestmentStrategySchema.nullable().optional(),
});

export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;

export const EbisuStateSchema = z.object({
    // Input
    messages: withLangGraph(
        z.custom<BaseMessage[]>(),
        MessagesZodMeta),
    question: z.string().optional(),
    error: z.string().optional(),
    intention: IntentionSchema.optional(),
    intentionReason: z.string().optional(),
    databaseExecutionType: DatabaseExecutionTypeSchema.optional(),
    stocks: z.array(StockSchema).optional(),
    userProfileUpdate: UserProfileUpdateSchema.optional(),
    activeUser: z
        .object({
            id: z.number(),
            name: z.string().nullable(),
            type: UserTypeSchema.nullable(),
            investmentHorizon: InvestmentHorizonSchema.nullable(),
            investmentStrategy: InvestmentStrategySchema.nullable(),
        })
        .optional(),
    missingUserFields: z.array(z.string()).optional(),
    missingStockFields: z.record(z.string(), z.array(z.string())).optional(),
    databaseExecutionResult: z.string().optional(),
    realTimeMarketShareResult: z.string().optional(),
});

export type GraphState = z.infer<typeof EbisuStateSchema>;
