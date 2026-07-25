import { GraphState, Stock } from "../schemas/message.schema"
import { MarketDataService } from "../../services/marketDataService.ts";
import {
    appendUnique,
    REAL_TIME_MARKET_TASK_ROUTE,
} from "../taskRouting.ts";
import { initializeDataSource } from "../../database/dataSource.ts";
import { StockRepository } from "../../database/repositories/stockRepository.ts";

const hasExplicitQuoteSymbols = (stocks: Stock[] = []): boolean => {
    return stocks.some((stock) => Boolean(stock.symbol?.trim()));
};

const loadPortfolioStocks = async (): Promise<Stock[]> => {
    const dataSource = await initializeDataSource();
    const repository = new StockRepository(dataSource);
    const stocks = await repository.findAll();

    return stocks.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        investmentAmount: stock.investmentAmount,
        country: stock.country,
        currency: stock.currency,
    }));
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

export const createGetRealTimeMarketShareNode = () => {

    const marketDataService = new MarketDataService();

    return async (state: GraphState): Promise<Partial<GraphState>> => {
        if (!state.question) {
            return {
                error: 'Nao foi possivel buscar market share sem uma pergunta.',
            };
        }

        try {

            const stocks = hasExplicitQuoteSymbols(state.stocks)
                ? state.stocks ?? []
                : await loadPortfolioStocks();

            const quoteResult = await marketDataService.getQuotes(stocks);

            const result = JSON.stringify({
                operation: 'real_time_quote',
                summary: quoteResult.summary,
                source: hasExplicitQuoteSymbols(state.stocks) ? 'explicit_stocks' : 'portfolio',
                quotes: quoteResult.quotes,
                missingSymbols: quoteResult.missingSymbols,
                question: state.question,
            });

            return {
                stocks,
                realTimeMarketShareResult: result,
                completedWorkflowTasks: appendUnique(
                    state.completedWorkflowTasks,
                    REAL_TIME_MARKET_TASK_ROUTE,
                ),
                workflowExecutionResults: [
                    ...(state.workflowExecutionResults ?? []),
                    result,
                ],
            };
        } catch (error: unknown) {
            return {
                error: `Falha ao consultar cotacoes em tempo real: ${getErrorMessage(error)}`,
            };
        }
    };
};
