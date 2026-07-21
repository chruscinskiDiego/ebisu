import { GraphState } from "../schemas/message.schema";
import { FinancialActionService } from "../../services/financialActionService.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";

const formatDatabaseExecutionResult = (
    result: Awaited<ReturnType<FinancialActionService['execute']>>,
): string => {
    return JSON.stringify({
        operation: result.operation,
        template: result.template,
        summary: result.summary,
        query: result.query,
        affected: result.affected,
        missingNames: result.missingNames,
        rows: result.rows,
        records: result.records?.map((record) => ({
            id: record.id,
            name: record.name,
            marketShare: record.marketShare,
        })),
    });
};

export const createFinancialActionDatabaseExecutionNode = (llm: OpenRouterService) => {
    const financialActionService = new FinancialActionService(llm);

    return async (state: GraphState): Promise<Partial<GraphState>> => {
        if (!state.question) {
            return {
                error: 'Nao foi possivel executar no banco sem uma pergunta.',
            };
        }

        const databaseExecutionType = state.databaseExecutionType ?? 'select';

        try {
            const result = await financialActionService.execute(
                databaseExecutionType,
                state.question,
                state.financialActions ?? [],
            );

            return {
                databaseExecutionType,
                databaseExecutionResult: formatDatabaseExecutionResult(result),
            };
        } catch (error: any) {
            return {
                error: `Falha ao executar operacao de financialActions no Postgres: ${error.message}`,
            };
        }
    };
};
