import { GraphState } from "../schemas/message.schema"

export const createGetRealTimeMarketShareNode = () => {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        if (!state.question) {
            return {
                error: 'Nao foi possivel buscar market share sem uma pergunta.',
            };
        }

        return {
            realTimeMarketShareResult:
                `Fluxo de market share em tempo real selecionado para: ${state.question}. Stocks: ${JSON.stringify(state.stocks ?? [])}`,
        };
    };
};
