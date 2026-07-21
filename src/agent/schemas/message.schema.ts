import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import { z } from 'zod/v3';

export const IntentionSchema = z.enum([
    'databaseExecution',
    'realTimeMarketShare',
    'unknown',
]);

export type Intention = z.infer<typeof IntentionSchema>;

export const DatabaseExecutionTypeSchema = z.enum(['select', 'insert', 'update', 'delete']);

export const FinancialActionSchema = z.object({
    name: z.string(),
    marketShare: z.number().nullable(),
});

export type DatabaseExecutionType = z.infer<typeof DatabaseExecutionTypeSchema>;
export type FinancialAction = z.infer<typeof FinancialActionSchema>;

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
    financialActions: z.array(FinancialActionSchema).optional(),
    databaseExecutionResult: z.string().optional(),
    realTimeMarketShareResult: z.string().optional(),
});

export type GraphState = z.infer<typeof EbisuStateSchema>;
