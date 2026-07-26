import type { Crypto, GraphState, Stock } from "../schemas/message.schema.ts";
import {
  CryptoMarketQuoteResult,
  MarketDataService,
  MarketQuoteResult,
} from "../../services/marketDataService.ts";
import {
  appendUnique,
  findWorkflowTaskByRoute,
  REAL_TIME_MARKET_TASK_ROUTE,
} from "../taskRouting.ts";
import { initializeDataSource } from "../../database/dataSource.ts";
import { CryptoRepository } from "../../database/repositories/cryptoRepository.ts";
import { StockRepository } from "../../database/repositories/stockRepository.ts";

type MarketAssetType = "stock" | "crypto";

type RealTimeMarketDataDependencies = {
  marketDataService: Pick<
    MarketDataService,
    "getStockQuotes" | "getCryptoQuotes"
  >;
  loadPortfolioStocks: () => Promise<Stock[]>;
  loadPortfolioCryptos: () => Promise<Crypto[]>;
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

const loadPortfolioCryptos = async (): Promise<Crypto[]> => {
  const dataSource = await initializeDataSource();
  const repository = new CryptoRepository(dataSource);
  const cryptos = await repository.findAll();

  return cryptos.map((crypto) => ({
    symbol: crypto.symbol,
    name: crypto.name,
    investmentAmount: crypto.investmentAmount,
    currency: crypto.currency,
  }));
};

const getRequestedAssetTypes = (state: GraphState): MarketAssetType[] => {
  const realTimeTask = findWorkflowTaskByRoute(
    state,
    REAL_TIME_MARKET_TASK_ROUTE,
  );
  const requestedTypes = new Set<MarketAssetType>(
    realTimeTask?.assetTypes ?? [],
  );

  if (requestedTypes.size === 0) {
    if (state.stocks?.length) requestedTypes.add("stock");
    if (state.cryptos?.length) requestedTypes.add("crypto");
  }

  // Keeps compatibility with older router results, which used an empty stocks
  // array to mean "quote my stock portfolio".
  if (requestedTypes.size === 0) requestedTypes.add("stock");

  return [...requestedTypes];
};

const emptyStockResult = (): MarketQuoteResult => ({
  summary: "",
  quotes: [],
  missingSymbols: [],
});

const emptyCryptoResult = (): CryptoMarketQuoteResult => ({
  summary: "",
  quotes: [],
  missingSymbols: [],
});

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

/**
 * Executes all real-time market data subtasks extracted from one prompt.
 * Stock and cryptocurrency APIs are independent and therefore run in parallel.
 */
export const createGetRealTimeMarketDataNode = (
  overrides: Partial<RealTimeMarketDataDependencies> = {},
) => {
  const dependencies: RealTimeMarketDataDependencies = {
    marketDataService: new MarketDataService(),
    loadPortfolioStocks,
    loadPortfolioCryptos,
    ...overrides,
  };

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.question) {
      return {
        error: "Nao foi possivel buscar dados de mercado sem uma pergunta.",
      };
    }

    try {
      const requestedAssetTypes = getRequestedAssetTypes(state);
      const requestsStocks = requestedAssetTypes.includes("stock");
      const requestsCryptos = requestedAssetTypes.includes("crypto");
      const stocksSource = requestsStocks
        ? state.stocks?.length
          ? "explicit"
          : "portfolio"
        : "not_requested";
      const cryptosSource = requestsCryptos
        ? state.cryptos?.length
          ? "explicit"
          : "portfolio"
        : "not_requested";

      const [stocks, cryptos] = await Promise.all([
        requestsStocks
          ? state.stocks?.length
            ? Promise.resolve(state.stocks)
            : dependencies.loadPortfolioStocks()
          : Promise.resolve(state.stocks ?? []),
        requestsCryptos
          ? state.cryptos?.length
            ? Promise.resolve(state.cryptos)
            : dependencies.loadPortfolioCryptos()
          : Promise.resolve(state.cryptos ?? []),
      ]);

      const [stockResult, cryptoResult] = await Promise.all([
        requestsStocks
          ? dependencies.marketDataService.getStockQuotes(stocks)
          : Promise.resolve(emptyStockResult()),
        requestsCryptos
          ? dependencies.marketDataService.getCryptoQuotes(cryptos)
          : Promise.resolve(emptyCryptoResult()),
      ]);

      const summary = [
        requestsStocks ? stockResult.summary : undefined,
        requestsCryptos ? cryptoResult.summary : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ");
      const executions = [
        requestsStocks
          ? {
              assetType: "stock",
              source: stocksSource,
              summary: stockResult.summary,
              quotes: stockResult.quotes,
              missingSymbols: stockResult.missingSymbols,
            }
          : undefined,
        requestsCryptos
          ? {
              assetType: "crypto",
              source: cryptosSource,
              summary: cryptoResult.summary,
              quotes: cryptoResult.quotes,
              missingSymbols: cryptoResult.missingSymbols,
            }
          : undefined,
      ].filter(Boolean);

      const result = JSON.stringify({
        operation: "real_time_quote",
        summary,
        source:
          stocksSource === "portfolio" || cryptosSource === "portfolio"
            ? "portfolio"
            : "explicit_assets",
        sources: {
          stocks: stocksSource,
          cryptos: cryptosSource,
        },
        requestedAssetTypes,
        executions,
        // `quotes` is retained for compatibility with existing stock responses.
        quotes: stockResult.quotes,
        cryptoQuotes: cryptoResult.quotes,
        missingSymbols: stockResult.missingSymbols,
        missingCryptoSymbols: cryptoResult.missingSymbols,
        question: state.question,
      });

      return {
        stocks,
        cryptos,
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

/** @deprecated Use createGetRealTimeMarketDataNode. */
export const createGetRealTimeMarketShareNode = createGetRealTimeMarketDataNode;
