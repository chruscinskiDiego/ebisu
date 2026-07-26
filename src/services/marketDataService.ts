import { config } from "../config.ts";
import type { Crypto, Stock } from "../agent/schemas/message.schema.ts";

export type MarketQuote = {
  requestedSymbol: string;
  symbol: string;
  name?: string;
  exchange?: string;
  price?: number;
  change?: number;
  changesPercentage?: number;
  volume?: number;
  dayLow?: number;
  dayHigh?: number;
  yearLow?: number;
  yearHigh?: number;
  timestamp?: number;
};

export type MarketQuoteResult = {
  summary: string;
  quotes: MarketQuote[];
  missingSymbols: string[];
};

/** Public price body returned by Binance's symbol price ticker endpoint. */
export type CryptoMarketQuote = {
  symbol: string;
  price: string;
};

export type CryptoMarketQuoteResult = {
  summary: string;
  quotes: CryptoMarketQuote[];
  missingSymbols: string[];
};

const getQuoteSymbol = (stock: Stock): string | null => {
  const symbol = stock.symbol?.trim().toUpperCase();

  if (!symbol) return null;

  const exchange = stock.exchange?.trim().toUpperCase();
  if (exchange === "B3" && !symbol.includes(".")) {
    return `${symbol}.SA`;
  }

  return symbol;
};

const normalizeCryptoSymbolPart = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

export const getCryptoQuoteSymbol = (crypto: Crypto): string | null => {
  const symbol = crypto.symbol ? normalizeCryptoSymbolPart(crypto.symbol) : "";

  if (!symbol) return null;

  const quoteCurrency =
    normalizeCryptoSymbolPart(crypto.currency ?? "USDT") || "USDT";

  return symbol.endsWith(quoteCurrency) ? symbol : `${symbol}${quoteCurrency}`;
};

const getNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value : undefined;
};

const parseQuote = (
  requestedSymbol: string,
  payload: unknown,
): MarketQuote | null => {
  if (!payload || typeof payload !== "object") return null;

  return {
    requestedSymbol,
    symbol:
      getString("symbol" in payload ? payload.symbol : undefined) ??
      requestedSymbol,
    name: getString("name" in payload ? payload.name : undefined),
    exchange: getString("exchange" in payload ? payload.exchange : undefined),
    price: getNumber("price" in payload ? payload.price : undefined),
    change: getNumber("change" in payload ? payload.change : undefined),
    changesPercentage: getNumber(
      "changesPercentage" in payload ? payload.changesPercentage : undefined,
    ),
    volume: getNumber("volume" in payload ? payload.volume : undefined),
    dayLow: getNumber("dayLow" in payload ? payload.dayLow : undefined),
    dayHigh: getNumber("dayHigh" in payload ? payload.dayHigh : undefined),
    yearLow: getNumber("yearLow" in payload ? payload.yearLow : undefined),
    yearHigh: getNumber("yearHigh" in payload ? payload.yearHigh : undefined),
    timestamp: getNumber(
      "timestamp" in payload ? payload.timestamp : undefined,
    ),
  };
};

const parseCryptoQuote = (payload: unknown): CryptoMarketQuote | null => {
  if (!payload || typeof payload !== "object") return null;

  const symbol = getString("symbol" in payload ? payload.symbol : undefined);
  const price = getString("price" in payload ? payload.price : undefined);

  if (!symbol || !price || !Number.isFinite(Number(price))) return null;

  return {
    symbol: symbol.toUpperCase(),
    price,
  };
};

const fetchJson = async (url: URL): Promise<unknown | null> => {
  const response = await fetch(url);

  if (!response.ok) return null;

  return response.json() as Promise<unknown>;
};

export class MarketDataService {
  async getStockQuotes(stocks: Stock[] = []): Promise<MarketQuoteResult> {
    const requestedSymbols = Array.from(
      new Set(
        stocks
          .map(getQuoteSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    );

    if (requestedSymbols.length === 0) {
      return {
        summary:
          "Nenhum ticker foi informado para consultar cotacao em tempo real.",
        quotes: [],
        missingSymbols: [],
      };
    }

    if (!config.fmp.api_key) {
      return {
        summary:
          "A chave da API de mercado nao esta configurada para consultar cotacoes em tempo real.",
        quotes: [],
        missingSymbols: requestedSymbols,
      };
    }

    const results = await Promise.all(
      requestedSymbols.map(async (symbol) => {
        try {
          return await this.getStockQuote(symbol);
        } catch (error: unknown) {
          console.error(
            `MarketDataService.getStockQuotes: erro ao consultar ${symbol}:`,
            error,
          );
          return null;
        }
      }),
    );

    const quotes = results.filter(
      (quote): quote is MarketQuote => quote !== null,
    );
    const foundSymbols = new Set(quotes.map((quote) => quote.requestedSymbol));
    const missingSymbols = requestedSymbols.filter(
      (symbol) => !foundSymbols.has(symbol),
    );

    return {
      summary:
        quotes.length > 0
          ? `Cotacao em tempo real consultada para ${quotes.map((quote) => quote.symbol).join(", ")}.`
          : "Nao foi possivel obter cotacoes em tempo real para os tickers informados.",
      quotes,
      missingSymbols,
    };
  }

  /**
   * Fetches one or many public cryptocurrency prices in a single HTTP request.
   * The returned quote objects intentionally keep Binance's generic
   * `{ symbol: string, price: string }` contract.
   */
  async getCryptoQuotes(
    cryptos: Crypto[] = [],
  ): Promise<CryptoMarketQuoteResult> {
    const requestedSymbols = Array.from(
      new Set(
        cryptos
          .map(getCryptoQuoteSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    );

    if (requestedSymbols.length === 0) {
      return {
        summary:
          "Nenhum simbolo de criptomoeda foi informado para consultar cotacao em tempo real.",
        quotes: [],
        missingSymbols: [],
      };
    }

    try {
      const tickerUrl = new URL("ticker/price", config.binance.base_url);

      if (requestedSymbols.length === 1) {
        tickerUrl.searchParams.set("symbol", requestedSymbols[0]);
      } else {
        tickerUrl.searchParams.set("symbols", JSON.stringify(requestedSymbols));
      }

      const data = await fetchJson(tickerUrl);
      const payloads = Array.isArray(data) ? data : data ? [data] : [];
      const quoteBySymbol = new Map<string, CryptoMarketQuote>();

      for (const payload of payloads) {
        const quote = parseCryptoQuote(payload);

        if (quote && requestedSymbols.includes(quote.symbol)) {
          quoteBySymbol.set(quote.symbol, quote);
        }
      }

      const quotes = requestedSymbols
        .map((symbol) => quoteBySymbol.get(symbol))
        .filter((quote): quote is CryptoMarketQuote => Boolean(quote));
      const missingSymbols = requestedSymbols.filter(
        (symbol) => !quoteBySymbol.has(symbol),
      );

      return {
        summary:
          quotes.length > 0
            ? `Cotacao de criptomoeda consultada para ${quotes.map((quote) => quote.symbol).join(", ")}.`
            : "Nao foi possivel obter cotacoes para as criptomoedas informadas.",
        quotes,
        missingSymbols,
      };
    } catch (error: unknown) {
      console.error(
        "MarketDataService.getCryptoQuotes: erro ao consultar criptomoedas:",
        error,
      );

      return {
        summary:
          "Nao foi possivel obter cotacoes para as criptomoedas informadas.",
        quotes: [],
        missingSymbols: requestedSymbols,
      };
    }
  }

  /** @deprecated Use getStockQuotes for an explicit asset-class API. */
  getQuotes(stocks: Stock[] = []): Promise<MarketQuoteResult> {
    return this.getStockQuotes(stocks);
  }

  private async getStockQuote(symbol: string): Promise<MarketQuote | null> {
    const directQuote = await this.fetchStockProfile(symbol, symbol);

    if (directQuote?.price !== undefined) return directQuote;

    const searchSymbolUrl = new URL("search-symbol", config.fmp.base_url);
    searchSymbolUrl.searchParams.set("query", symbol);
    searchSymbolUrl.searchParams.set("apikey", config.fmp.api_key);

    const searchData = await fetchJson(searchSymbolUrl);
    const [firstMatch] = Array.isArray(searchData)
      ? searchData
      : searchData
        ? [searchData]
        : [];
    const resolvedSymbol =
      firstMatch && typeof firstMatch === "object" && "symbol" in firstMatch
        ? getString(firstMatch.symbol)
        : undefined;

    if (!resolvedSymbol) return null;

    return this.fetchStockProfile(resolvedSymbol, symbol);
  }

  private async fetchStockProfile(
    profileSymbol: string,
    requestedSymbol: string,
  ): Promise<MarketQuote | null> {
    const profileUrl = new URL("profile", config.fmp.base_url);
    profileUrl.searchParams.set("symbol", profileSymbol);
    profileUrl.searchParams.set("apikey", config.fmp.api_key);

    const profileData = await fetchJson(profileUrl);
    const [firstQuote] = Array.isArray(profileData)
      ? profileData
      : profileData
        ? [profileData]
        : [];
    const quote = parseQuote(requestedSymbol, firstQuote);

    return quote?.price !== undefined ? quote : null;
  }
}
