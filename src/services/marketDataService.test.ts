import { jest } from "@jest/globals";
import {
  MarketDataService,
  getCryptoQuoteSymbol,
} from "./marketDataService.ts";

const crypto = (symbol: string, currency: string | null = "USDT") => ({
  symbol,
  name: null,
  investmentAmount: null,
  currency,
});

describe("MarketDataService cryptocurrency quotes", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("normalizes a base asset or keeps an already complete market pair", () => {
    expect(getCryptoQuoteSymbol(crypto("BTC"))).toBe("BTCUSDT");
    expect(getCryptoQuoteSymbol(crypto("btc/usdt"))).toBe("BTCUSDT");
    expect(getCryptoQuoteSymbol(crypto("BTC", "BRL"))).toBe("BTCBRL");
  });

  it("preserves the generic symbol and price response body for one crypto", async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "BTCUSDT",
        price: "64682.01000000",
      }),
    } as Response);
    globalThis.fetch = fetchMock;

    const result = await new MarketDataService().getCryptoQuotes([
      crypto("BTC"),
    ]);

    expect(result.quotes).toEqual([
      {
        symbol: "BTCUSDT",
        price: "64682.01000000",
      },
    ]);
    expect(result.missingSymbols).toEqual([]);

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/api/v3/ticker/price");
    expect(requestedUrl.searchParams.get("symbol")).toBe("BTCUSDT");
  });

  it("gets multiple cryptocurrency pairs with one batch request", async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => [
        { symbol: "ETHUSDT", price: "3450.12000000" },
        { symbol: "BTCUSDT", price: "64682.01000000" },
      ],
    } as Response);
    globalThis.fetch = fetchMock;

    const result = await new MarketDataService().getCryptoQuotes([
      crypto("BTC"),
      crypto("ETH"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.quotes).toEqual([
      { symbol: "BTCUSDT", price: "64682.01000000" },
      { symbol: "ETHUSDT", price: "3450.12000000" },
    ]);

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(
      JSON.parse(requestedUrl.searchParams.get("symbols") ?? "[]"),
    ).toEqual(["BTCUSDT", "ETHUSDT"]);
  });
});
