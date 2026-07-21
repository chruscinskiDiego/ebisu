import { z } from 'zod/v3';

export const StockSelectQuerySchema = z.object({
  query: z
    .string()
    .describe('Safe PostgreSQL SELECT query for the stocks table'),
  reasoning: z
    .string()
    .describe('Brief explanation of how the query answers the user question'),
});

export type StockSelectQueryData = z.infer<typeof StockSelectQuerySchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'PostgreSQL SELECT Query Builder - Generate safe read-only stock queries',
    output: 'Return JSON with: query, reasoning',
    database: {
      dialect: 'PostgreSQL',
      allowedTables: [
        {
          name: 'stocks',
          description: 'Stocks stored by the user',
          columns: [
            { name: 'id', type: 'integer', description: 'Primary key' },
            { name: 'symbol', type: 'varchar', description: 'Ticker symbol, such as AAPL or TTWO' },
            { name: 'name', type: 'varchar', description: 'Company or asset name' },
            { name: 'exchange', type: 'varchar', description: 'Exchange where the stock trades' },
            { name: 'investment_amount', type: 'double precision', description: 'Optional amount invested by the user' },
            { name: 'country', type: 'varchar', description: 'Optional country' },
            { name: 'currency', type: 'varchar', description: 'Optional currency' },
            { name: 'created_at', type: 'timestamp', description: 'Creation timestamp' },
            { name: 'updated_at', type: 'timestamp', description: 'Last update timestamp' },
          ],
        },
      ],
    },
    rules: [
      'Generate exactly one PostgreSQL SELECT statement',
      'Use only the stocks table',
      'Use only these columns: id, symbol, name, exchange, investment_amount, country, currency, created_at, updated_at',
      'Do not generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, or transaction statements',
      'Do not use semicolons',
      'For broad questions like "minhas acoes", "liste minhas acoes", or "quais ativos tenho", select all rows ordered by symbol',
      'Do not interpret generic words like "acoes", "ativos", "carteira", or "portfolio" as ticker symbols',
      'Only filter by symbol or name when the user explicitly mentions a specific ticker/company/asset name',
      'Always include LIMIT 100 unless the user asks for fewer rows, then use that smaller limit',
    ],
    examples: [
      {
        question: 'Quais sao minhas acoes?',
        query:
          'SELECT id, symbol, name, exchange, investment_amount, country, currency, created_at, updated_at FROM stocks ORDER BY symbol ASC LIMIT 100',
        reasoning:
          'A pergunta pede uma listagem geral das acoes cadastradas, sem filtro por ticker.',
      },
      {
        question: 'Mostre a TTWO',
        query:
          "SELECT id, symbol, name, exchange, investment_amount, country, currency, created_at, updated_at FROM stocks WHERE symbol ILIKE 'TTWO' OR name ILIKE 'TTWO' ORDER BY symbol ASC LIMIT 100",
        reasoning:
          'A pergunta menciona explicitamente TTWO, entao a consulta filtra por ticker ou nome.',
      },
      {
        question: 'Liste acoes com investimento acima de 100',
        query:
          'SELECT id, symbol, name, exchange, investment_amount, country, currency, created_at, updated_at FROM stocks WHERE investment_amount > 100 ORDER BY investment_amount DESC LIMIT 100',
        reasoning:
          'A pergunta pede acoes cujo valor investido seja maior que 100.',
      },
    ],
  });
};

export const getUserPromptTemplate = (input: {
  question: string;
  stocks?: Array<{
    symbol: string | null;
    name: string | null;
    exchange: string | null;
    investmentAmount: number | null;
    country: string | null;
    currency: string | null;
  }>;
}): string => {
  return JSON.stringify(input);
};
