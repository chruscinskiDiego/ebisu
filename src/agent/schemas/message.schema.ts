import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import { z } from 'zod/v3';

export const EbisuStateSchema = z.object({
    // Input
    messages: withLangGraph(
        z.custom<BaseMessage[]>(),
        MessagesZodMeta),
        question: z.string().optional(),
    error: z.string().optional(),

});

export type GraphState = z.infer<typeof EbisuStateSchema>;