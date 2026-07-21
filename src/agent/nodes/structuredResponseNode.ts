import { AIMessage } from "@langchain/core/messages"
import { GraphState } from "../schemas/message.schema"
import { OpenRouterService } from "../../services/openrouterService";
import {
    FinalResponseSchema,
    getSystemPrompt,
    getUserPromptTemplate,
} from "../../prompts/v1/finalResponse.ts";

const getFallbackMessage = (state: GraphState): string => {
    if (state.error) {
        return `Nao consegui processar sua mensagem: ${state.error}`;
    }

    if (state.databaseExecutionResult) {
        return state.databaseExecutionResult;
    }

    if (state.realTimeMarketShareResult) {
        return state.realTimeMarketShareResult;
    }

    return `Nao identifiquei um fluxo para sua pergunta. Motivo: ${state.intentionReason ?? 'intencao desconhecida'}`;
};

export const createStructuredResponseNode = (llmClient: OpenRouterService) => {

    return async (state: GraphState): Promise<Partial<GraphState>> => {

        try {
            const { data, error } = await llmClient.generateStructured(
                getSystemPrompt(),
                getUserPromptTemplate({
                    question: state.question,
                    error: state.error,
                    intention: state.intention,
                    intentionReason: state.intentionReason,
                    databaseExecutionType: state.databaseExecutionType,
                    financialActions: state.financialActions,
                    databaseExecutionResult: state.databaseExecutionResult,
                    realTimeMarketShareResult: state.realTimeMarketShareResult,
                }),
                FinalResponseSchema,
            );

            const message = error || !data?.message
                ? getFallbackMessage(state)
                : data.message;

            return {
                messages: [
                    new AIMessage(message),
                ],
            };
        } catch (error: any) {
            console.error('Error analyzing query:', error.message);
            return {
                messages: [
                    new AIMessage(`Nao consegui gerar uma resposta: ${error.message}`),
                ],
            };
        }
    }
}
