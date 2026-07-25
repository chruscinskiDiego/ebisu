import { config } from '../config.ts';
import type { Stock } from '../agent/schemas/message.schema.ts';

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

const getQuoteSymbol = (stock: Stock): string | null => {
  const symbol = stock.symbol?.trim().toUpperCase();

  if (!symbol) return null;

  const exchange = stock.exchange?.trim().toUpperCase();
  if (exchange === 'B3' && !symbol.includes('.')) {
    return `${symbol}.SA`;
  }

  return symbol;
};

const getNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const parseQuote = (
  requestedSymbol: string,
  payload: unknown,
): MarketQuote | null => {
  if (!payload || typeof payload !== 'object') return null;

  return {
    requestedSymbol,
    symbol: getString('symbol' in payload ? payload.symbol : undefined) ?? requestedSymbol,
    name: getString('name' in payload ? payload.name : undefined),
    exchange: getString('exchange' in payload ? payload.exchange : undefined),
    price: getNumber('price' in payload ? payload.price : undefined),
    change: getNumber('change' in payload ? payload.change : undefined),
    changesPercentage: getNumber(
      'changesPercentage' in payload ? payload.changesPercentage : undefined,
    ),
    volume: getNumber('volume' in payload ? payload.volume : undefined),
    dayLow: getNumber('dayLow' in payload ? payload.dayLow : undefined),
    dayHigh: getNumber('dayHigh' in payload ? payload.dayHigh : undefined),
    yearLow: getNumber('yearLow' in payload ? payload.yearLow : undefined),
    yearHigh: getNumber('yearHigh' in payload ? payload.yearHigh : undefined),
    timestamp: getNumber('timestamp' in payload ? payload.timestamp : undefined),
  };
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

export class MarketDataService {

  async getQuotes(stocks: Stock[] = []): Promise<MarketQuoteResult> {
    const requestedSymbols = Array.from(new Set(
      stocks
        .map(getQuoteSymbol)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ));

    console.log(1);

    if (requestedSymbols.length === 0) {
      return {
        summary: 'Nenhum ticker foi informado para consultar cotacao em tempo real.',
        quotes: [],
        missingSymbols: [],
      };
    }

    console.log(2);

    if (!config.fmp.api_key) {
      return {
        summary: 'A chave da API de mercado nao esta configurada para consultar cotacoes em tempo real.',
        quotes: [],
        missingSymbols: requestedSymbols,
      };
    }

    console.log(3);

    const quotes: MarketQuote[] = [];
    const missingSymbols: string[] = [];

    for (const symbol of requestedSymbols) {

      console.log('4 ' + symbol);

      try {

        const profileUrl = new URL('profile', config.fmp.base_url);

        profileUrl.searchParams.set('symbol', symbol);
        profileUrl.searchParams.set('apikey', config.fmp.api_key);

        const response = await fetch(profileUrl);

        if (!response.ok) {
          missingSymbols.push(symbol);
          continue;
        }

        console.log('RESPONSE: ' + JSON.stringify(response));
        const data = await response.json() as unknown;

        console.log('DATA: ' + JSON.stringify(data));

        const [firstQuote] = Array.isArray(data) ? data : [data];

        console.log('FIRST QUOTE: ' + JSON.stringify(firstQuote));

        const quote = parseQuote(symbol, firstQuote);

        if (!quote?.price) {
          missingSymbols.push(symbol);
          continue;
        }

        quotes.push(quote);
      } catch (error: unknown) {
        missingSymbols.push(`${symbol}: ${getErrorMessage(error)}`);

        console.error(`MarketDataService.getQuotes: Error fetching quote for ${symbol}:`, error);
      }
    }

    //TO-DO: meter um axios

    for (const missingSymbol of missingSymbols) {

      const searchSymbolUrl = new URL('search-symbol', config.fmp.base_url);

      searchSymbolUrl.searchParams.set('query', missingSymbol);
      searchSymbolUrl.searchParams.set('apikey', config.fmp.api_key);

      const symbolResponse = await fetch(searchSymbolUrl);

      if (!symbolResponse.ok) {
        missingSymbols.push(missingSymbol);
        continue;
      }

      const symbolData = await symbolResponse.json() as any;

      const [symbolFirstQuote] = Array.isArray(symbolData) ? symbolData : [symbolData];

      console.log('DATA: ' + JSON.stringify(symbolFirstQuote));

      const realSymbol = symbolFirstQuote?.symbol ?? missingSymbol;

      const profileUrl = new URL('profile', config.fmp.base_url);

      profileUrl.searchParams.set('symbol', realSymbol);
      profileUrl.searchParams.set('apikey', config.fmp.api_key);

      const response = await fetch(profileUrl);

      console.log('RESPONSE: ' + JSON.stringify(response));
      const profileData = await response.json() as unknown;

      console.log('DATA: ' + JSON.stringify(profileData));

      const [firstQuote] = Array.isArray(profileData) ? profileData : [profileData];

      console.log('FIRST QUOTE: ' + JSON.stringify(firstQuote));

      const quote = parseQuote(realSymbol, firstQuote);

      if (!quote?.price) {
        continue;
      }

      quotes.push(quote);

    }

    console.log(`MarketDataService.getQuotes: ${quotes.length} quotes found, ${missingSymbols.length} missing symbols.`);

    return {
      summary:
        quotes.length > 0
          ? `Cotacao em tempo real consultada para ${quotes.map((quote) => quote.symbol).join(', ')}.`
          : 'Nao foi possivel obter cotacoes em tempo real para os tickers informados.',
      quotes,
      missingSymbols,
    };
  }
}
