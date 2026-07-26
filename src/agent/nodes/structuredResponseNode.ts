import { AIMessage } from "@langchain/core/messages"
import { GraphState } from "../schemas/message.schema"
import { OpenRouterService } from "../../services/openrouterService.ts";
import {
    FinalResponseSchema,
    getSystemPrompt,
    getUserPromptTemplate,
} from "../../prompts/v1/finalResponse.ts";

const userFieldLabels: Record<string, string> = {
    name: 'seu nome',
    type: 'seu nível de experiência',
    investmentHorizon: 'seu horizonte de investimento',
    investmentStrategy: 'sua estratégia preferida',
};

const stockFieldLabels: Record<string, string> = {
    symbol: 'ticker',
    name: 'nome da empresa ou ativo',
    exchange: 'bolsa',
    investmentAmount: 'valor investido',
    country: 'país',
    currency: 'moeda',
};

const cryptoFieldLabels: Record<string, string> = {
    symbol: 'simbolo',
    name: 'nome da criptomoeda',
    investmentAmount: 'valor investido',
    currency: 'moeda de cotacao',
};

const formatUserMissingFields = (fields: string[]): string => {
    const labels = fields.map((field) => userFieldLabels[field] ?? field);

    return [
        'Bom te ver por aqui. Para eu adaptar melhor as respostas ao seu jeito de investir, me conte rapidinho:',
        labels.map((label) => `- ${label}`).join('\n'),
        '',
        'Pode responder em uma frase, por exemplo: "Meu nome é Diego, sou iniciante, invisto pensando no longo prazo e gosto de dividendos".',
        'Para experiência, você pode usar algo como iniciante, intermediário, avançado ou profissional. Para estratégia, exemplos: valor, crescimento, dividendos, qualidade, momentum, passiva ou especulativa.',
    ].join('\n');
};

const formatStockMissingFields = (missingStockFields: Record<string, string[]>): string => {
    const formattedStocks = Object.entries(missingStockFields)
        .map(([stock, fields]) => {
            const labels = fields.map((field) => stockFieldLabels[field] ?? field).join(', ');
            return `- ${stock}: ${labels}`;
        })
        .join('\n');

    return [
        'Consigo continuar, só preciso completar alguns detalhes do ativo:',
        formattedStocks,
        '',
        'Exemplo: "TTWO, Take-Two Interactive, NASDAQ, US$ 200".',
    ].join('\n');
};

const formatCryptoMissingFields = (missingCryptoFields: Record<string, string[]>): string => {
    const formattedCryptos = Object.entries(missingCryptoFields)
        .map(([crypto, fields]) => {
            const labels = fields.map((field) => cryptoFieldLabels[field] ?? field).join(', ');
            return `- ${crypto}: ${labels}`;
        })
        .join('\n');

    return [
        'Consigo continuar, so preciso completar alguns detalhes da criptomoeda:',
        formattedCryptos,
        '',
        'Exemplo: "BTC, Bitcoin, 200 USDT".',
    ].join('\n');
};

const getErrorMessage = (error: unknown): string => {
    if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
    ) {
        return error.message;
    }

    return String(error);
};

const formatWorkflowResults = (state: GraphState): string => {
    const results = Array.from(new Set([
        ...(state.workflowExecutionResults ?? []),
        state.userExecutionResult,
        state.databaseExecutionResult,
        state.realTimeMarketShareResult,
    ].filter((result): result is string => Boolean(result))));

    return [
        ...results,
        state.missingUserFields?.length ? formatUserMissingFields(state.missingUserFields) : undefined,
        state.missingStockFields && Object.keys(state.missingStockFields).length > 0
            ? formatStockMissingFields(state.missingStockFields)
            : undefined,
        state.missingCryptoFields && Object.keys(state.missingCryptoFields).length > 0
            ? formatCryptoMissingFields(state.missingCryptoFields)
            : undefined,
    ].filter(Boolean).join('\n\n');
};

const getFallbackMessage = (state: GraphState): string => {
    if (state.error) {
        return `Nao consegui processar sua mensagem: ${state.error}`;
    }

    if (state.missingStockFields && Object.keys(state.missingStockFields).length > 0) {
        return formatStockMissingFields(state.missingStockFields);
    }

    if (state.missingCryptoFields && Object.keys(state.missingCryptoFields).length > 0) {
        return formatCryptoMissingFields(state.missingCryptoFields);
    }

    if (
        state.userExecutionResult ||
        state.databaseExecutionResult ||
        state.realTimeMarketShareResult
    ) {
        return formatWorkflowResults(state);
    }

    if (state.missingUserFields?.length) {
        return formatUserMissingFields(state.missingUserFields);
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
                    workflowTasks: state.workflowTasks,
                    completedWorkflowTasks: state.completedWorkflowTasks,
                    databaseExecutionType: state.databaseExecutionType,
                    stocks: state.stocks,
                    cryptos: state.cryptos,
                    activeUser: state.activeUser,
                    missingUserFields: state.missingUserFields,
                    missingStockFields: state.missingStockFields,
                    missingCryptoFields: state.missingCryptoFields,
                    userExecutionResult: state.userExecutionResult,
                    databaseExecutionResult: state.databaseExecutionResult,
                    realTimeMarketShareResult: state.realTimeMarketShareResult,
                    workflowExecutionResults: state.workflowExecutionResults,
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
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            console.error('Error analyzing query:', message);
            return {
                messages: [
                    new AIMessage(`Nao consegui gerar uma resposta: ${message}`),
                ],
            };
        }
    }
}
