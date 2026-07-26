import { jest } from "@jest/globals";
import type { Crypto, GraphState, Stock } from "../schemas/message.schema.ts";
import type { MarketDataService } from "../../services/marketDataService.ts";
import { createGetRealTimeMarketDataNode } from "./getRealTimeMarketShareNode.ts";

describe("createGetRealTimeMarketDataNode", () => {
  it("runs stock and cryptocurrency quote subtasks in parallel from one prompt", async () => {
    let startedTasks = 0;
    let releaseBothTasks: (() => void) | undefined;
    const bothTasksStarted = new Promise<void>((resolve) => {
      releaseBothTasks = resolve;
    });
    const waitForBothTasks = async () => {
      startedTasks += 1;
      if (startedTasks === 2) releaseBothTasks?.();
      await bothTasksStarted;
    };
    const getStockQuotes = jest.fn<MarketDataService["getStockQuotes"]>(
      async () => {
        await waitForBothTasks();
        return {
          summary: "Cotacao em tempo real consultada para AAPL.",
          quotes: [
            {
              requestedSymbol: "AAPL",
              symbol: "AAPL",
              price: 213.5,
            },
          ],
          missingSymbols: [],
        };
      },
    );
    const getCryptoQuotes = jest.fn<MarketDataService["getCryptoQuotes"]>(
      async () => {
        await waitForBothTasks();
        return {
          summary: "Cotacao de criptomoeda consultada para BTCUSDT.",
          quotes: [
            {
              symbol: "BTCUSDT",
              price: "64682.01000000",
            },
          ],
          missingSymbols: [],
        };
      },
    );
    const loadPortfolioStocks = jest.fn<() => Promise<Stock[]>>(async () => []);
    const loadPortfolioCryptos = jest.fn<() => Promise<Crypto[]>>(
      async () => [],
    );
    const node = createGetRealTimeMarketDataNode({
      marketDataService: {
        getStockQuotes,
        getCryptoQuotes,
      },
      loadPortfolioStocks,
      loadPortfolioCryptos,
    });
    const state = {
      messages: [],
      question: "Qual o valor atual de AAPL e BTC?",
      workflowTasks: [
        {
          intention: "realTimeMarketShare",
          route: "getRealTimeMarketShare",
          databaseExecutionType: "select",
          assetTypes: ["stock", "crypto"],
        },
      ],
      stocks: [
        {
          symbol: "AAPL",
          name: "Apple",
          exchange: "NASDAQ",
          investmentAmount: null,
          country: null,
          currency: "USD",
        },
      ],
      cryptos: [
        {
          symbol: "BTC",
          name: "Bitcoin",
          investmentAmount: null,
          currency: "USDT",
        },
      ],
    } as GraphState;

    const result = await node(state);
    const payload = JSON.parse(result.realTimeMarketShareResult ?? "{}");

    expect(getStockQuotes).toHaveBeenCalledWith(state.stocks);
    expect(getCryptoQuotes).toHaveBeenCalledWith(state.cryptos);
    expect(loadPortfolioStocks).not.toHaveBeenCalled();
    expect(loadPortfolioCryptos).not.toHaveBeenCalled();
    expect(payload.requestedAssetTypes).toEqual(["stock", "crypto"]);
    expect(payload.cryptoQuotes).toEqual([
      { symbol: "BTCUSDT", price: "64682.01000000" },
    ]);
    expect(payload.quotes[0]).toMatchObject({ symbol: "AAPL", price: 213.5 });
    expect(result.completedWorkflowTasks).toContain("getRealTimeMarketShare");
  });

  it("loads only the requested portfolio asset class when symbols are omitted", async () => {
    const storedCryptos: Crypto[] = [
      {
        symbol: "ETH",
        name: "Ethereum",
        investmentAmount: 100,
        currency: "USDT",
      },
    ];
    const getStockQuotes = jest.fn<MarketDataService["getStockQuotes"]>();
    const getCryptoQuotes = jest
      .fn<MarketDataService["getCryptoQuotes"]>()
      .mockResolvedValue({
        summary: "Cotacao de criptomoeda consultada para ETHUSDT.",
        quotes: [{ symbol: "ETHUSDT", price: "3450.12000000" }],
        missingSymbols: [],
      });
    const loadPortfolioStocks = jest.fn<() => Promise<Stock[]>>(async () => []);
    const loadPortfolioCryptos = jest
      .fn<() => Promise<Crypto[]>>()
      .mockResolvedValue(storedCryptos);
    const node = createGetRealTimeMarketDataNode({
      marketDataService: { getStockQuotes, getCryptoQuotes },
      loadPortfolioStocks,
      loadPortfolioCryptos,
    });

    await node({
      messages: [],
      question: "Quais os valores atuais das minhas criptos?",
      workflowTasks: [
        {
          intention: "realTimeMarketShare",
          route: "getRealTimeMarketShare",
          databaseExecutionType: "select",
          assetTypes: ["crypto"],
        },
      ],
      stocks: [],
      cryptos: [],
    } as GraphState);

    expect(loadPortfolioCryptos).toHaveBeenCalledTimes(1);
    expect(getCryptoQuotes).toHaveBeenCalledWith(storedCryptos);
    expect(loadPortfolioStocks).not.toHaveBeenCalled();
    expect(getStockQuotes).not.toHaveBeenCalled();
  });
});
