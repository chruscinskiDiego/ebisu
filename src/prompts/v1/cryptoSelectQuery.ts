import { z } from "zod/v3";

export const CryptoSelectQuerySchema = z.object({
  query: z
    .string()
    .describe("Safe PostgreSQL SELECT query for the cryptos table"),
  reasoning: z
    .string()
    .describe("Brief explanation of how the query answers the user question"),
});

export type CryptoSelectQueryData = z.infer<typeof CryptoSelectQuerySchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: "PostgreSQL SELECT Query Builder - Generate safe read-only crypto queries",
    output: "Return JSON with: query, reasoning",
    database: {
      dialect: "PostgreSQL",
      allowedTables: [
        {
          name: "cryptos",
          description: "Cryptocurrencies stored by the user",
          columns: [
            { name: "id", type: "integer", description: "Primary key" },
            {
              name: "symbol",
              type: "varchar",
              description: "Unique cryptocurrency symbol",
            },
            {
              name: "name",
              type: "varchar",
              description: "Cryptocurrency name",
            },
            {
              name: "investment_amount",
              type: "double precision",
              description: "Amount invested by the user",
            },
            {
              name: "currency",
              type: "varchar",
              description: "Quote currency; currently USDT",
            },
            {
              name: "created_at",
              type: "timestamp",
              description: "Creation timestamp",
            },
            {
              name: "updated_at",
              type: "timestamp",
              description: "Last update timestamp",
            },
          ],
        },
      ],
    },
    rules: [
      "Generate exactly one PostgreSQL SELECT statement",
      "Use only the cryptos table",
      "Use only these columns: id, symbol, name, investment_amount, currency, created_at, updated_at",
      "Do not generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, or transaction statements",
      "Do not use semicolons",
      'For broad questions like "minhas criptomoedas", "liste minhas criptos", or "quais criptoativos tenho", select all rows ordered by symbol',
      'Do not interpret generic words like "criptomoedas", "criptos", "criptoativos", "carteira", or "portfolio" as cryptocurrency symbols',
      "Only filter by symbol or name when the user explicitly mentions a specific cryptocurrency symbol or name",
      "Always include LIMIT 100 unless the user asks for fewer rows, then use that smaller limit",
    ],
    examples: [
      {
        question: "Quais sao minhas criptomoedas?",
        query:
          "SELECT id, symbol, name, investment_amount, currency, created_at, updated_at FROM cryptos ORDER BY symbol ASC LIMIT 100",
        reasoning:
          "A pergunta pede uma listagem geral das criptomoedas cadastradas, sem filtro por simbolo.",
      },
      {
        question: "Mostre o BTC",
        query:
          "SELECT id, symbol, name, investment_amount, currency, created_at, updated_at FROM cryptos WHERE symbol ILIKE 'BTC' OR name ILIKE 'BTC' ORDER BY symbol ASC LIMIT 100",
        reasoning:
          "A pergunta menciona explicitamente BTC, entao a consulta filtra por simbolo ou nome.",
      },
      {
        question: "Liste criptomoedas com investimento acima de 100",
        query:
          "SELECT id, symbol, name, investment_amount, currency, created_at, updated_at FROM cryptos WHERE investment_amount > 100 ORDER BY investment_amount DESC LIMIT 100",
        reasoning:
          "A pergunta pede criptomoedas cujo valor investido seja maior que 100.",
      },
    ],
  });
};

export const getUserPromptTemplate = (input: {
  question: string;
  cryptos?: Array<{
    symbol: string | null;
    name: string | null;
    investmentAmount: number | null;
    currency: string | null;
  }>;
}): string => {
  return JSON.stringify(input);
};
