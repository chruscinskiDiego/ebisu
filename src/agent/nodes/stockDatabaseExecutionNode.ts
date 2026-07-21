import { GraphState } from "../schemas/message.schema";
import { StockService } from "../../services/stockService.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";

const formatDatabaseExecutionResult = (
    result: Awaited<ReturnType<StockService['execute']>>,
): string => {
    return JSON.stringify({
        operation: result.operation,
        template: result.template,
        summary: result.summary,
        query: result.query,
        affected: result.affected,
        missingSymbols: result.missingSymbols,
        missingStockFields: result.missingStockFields,
        insertedSymbols: result.insertedSymbols,
        updatedSymbols: result.updatedSymbols,
        rows: result.rows,
        records: result.records?.map((record) => ({
            id: record.id,
            symbol: record.symbol,
            name: record.name,
            exchange: record.exchange,
            investmentAmount: record.investmentAmount,
            country: record.country,
            currency: record.currency,
        })),
    });
};

export const createStockDatabaseExecutionNode = (llm: OpenRouterService) => {
    const stockService = new StockService(llm);

    return async (state: GraphState): Promise<Partial<GraphState>> => {
        if (!state.question) {
            return {
                error: 'Nao foi possivel executar no banco sem uma pergunta.',
            };
        }

        const databaseExecutionType = state.databaseExecutionType ?? 'select';

        try {
            const result = await stockService.execute(
                databaseExecutionType,
                state.question,
                state.stocks ?? [],
            );

            return {
                databaseExecutionType,
                databaseExecutionResult: formatDatabaseExecutionResult(result),
                missingStockFields: result.missingStockFields,
            };

            
        } catch (error: any) {
            return {
                error: `Falha ao executar operacao de stocks no Postgres: ${error.message}`,
            };
        }
    };
};
