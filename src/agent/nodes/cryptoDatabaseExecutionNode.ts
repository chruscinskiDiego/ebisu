import { GraphState } from "../schemas/message.schema.ts";
import { CryptoService } from "../../services/cryptoService.ts";
import { OpenRouterService } from "../../services/openrouterService.ts";
import {
  appendUnique,
  CRYPTO_DATABASE_TASK_ROUTE,
  findWorkflowTaskByRoute,
} from "../taskRouting.ts";

const getErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
};

const formatDatabaseExecutionResult = (
  result: Awaited<ReturnType<CryptoService["execute"]>>,
): string => {
  return JSON.stringify({
    operation: result.operation,
    template: result.template,
    summary: result.summary,
    query: result.query,
    affected: result.affected,
    missingSymbols: result.missingSymbols,
    missingCryptoFields: result.missingCryptoFields,
    insertedSymbols: result.insertedSymbols,
    updatedSymbols: result.updatedSymbols,
    rows: result.rows,
    records: result.records?.map((record) => ({
      id: record.id,
      symbol: record.symbol,
      name: record.name,
      investmentAmount: record.investmentAmount,
      currency: record.currency,
    })),
  });
};

export const createCryptoDatabaseExecutionNode = (llm: OpenRouterService) => {
  const cryptoService = new CryptoService(llm);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.question) {
      return {
        error: "Nao foi possivel executar no banco sem uma pergunta.",
      };
    }

    const cryptoTask = findWorkflowTaskByRoute(
      state,
      CRYPTO_DATABASE_TASK_ROUTE,
    );
    const databaseExecutionType =
      cryptoTask?.databaseExecutionType ??
      state.databaseExecutionType ??
      "select";

    try {
      const result = await cryptoService.execute(
        databaseExecutionType,
        state.question,
        state.cryptos ?? [],
      );

      const formattedResult = formatDatabaseExecutionResult(result);

      return {
        databaseExecutionType,
        databaseExecutionResult: formattedResult,
        missingCryptoFields: result.missingCryptoFields,
        completedWorkflowTasks: appendUnique(
          state.completedWorkflowTasks,
          CRYPTO_DATABASE_TASK_ROUTE,
        ),
        workflowExecutionResults: [
          ...(state.workflowExecutionResults ?? []),
          formattedResult,
        ],
      };
    } catch (error: unknown) {
      return {
        error: `Falha ao executar operacao de criptomoedas no Postgres: ${getErrorMessage(error)}`,
      };
    }
  };
};
