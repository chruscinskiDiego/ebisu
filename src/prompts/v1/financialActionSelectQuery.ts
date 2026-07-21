import { z } from 'zod/v3';

export const FinancialActionSelectQuerySchema = z.object({
  query: z
    .string()
    .describe('Safe PostgreSQL SELECT query for the financial_actions table'),
  reasoning: z
    .string()
    .describe('Brief explanation of how the query answers the user question'),
});

export type FinancialActionSelectQueryData = z.infer<typeof FinancialActionSelectQuerySchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'PostgreSQL SELECT Query Builder - Generate safe read-only queries',
    output: 'Return JSON with: query, reasoning',
    database: {
      dialect: 'PostgreSQL',
      allowedTables: [
        {
          name: 'financial_actions',
          description: 'Financial actions/assets stored by the user',
          columns: [
            { name: 'id', type: 'integer', description: 'Primary key' },
            { name: 'name', type: 'varchar', description: 'Ticker, company, asset, or financial action name' },
            { name: 'marketShare', type: 'double precision', description: 'Numeric value associated with the action, such as amount, allocation, price, or market share' },
            { name: 'createdAt', type: 'timestamp', description: 'Creation timestamp' },
            { name: 'updatedAt', type: 'timestamp', description: 'Last update timestamp' },
          ],
        },
      ],
    },
    rules: [
      'Generate exactly one PostgreSQL SELECT statement',
      'Use only the financial_actions table',
      'Use only these columns: id, name, "marketShare", "createdAt", "updatedAt"',
      'Do not generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, or transaction statements',
      'Do not use semicolons',
      'For broad questions like "minhas acoes", "liste minhas acoes", or "quais acoes tenho", select all rows ordered by name',
      'Do not interpret generic words like "acoes", "ativos", "carteira", or "portfolio" as ticker names',
      'Only filter by name when the user explicitly mentions a specific ticker/company/asset name',
      'Always include LIMIT 100 unless the user asks for fewer rows, then use that smaller limit',
      'Use double quotes for camelCase columns: "marketShare", "createdAt", "updatedAt"',
    ],
    examples: [
      {
        question: 'Quais sao minhas acoes?',
        query:
          'SELECT id, name, "marketShare", "createdAt", "updatedAt" FROM financial_actions ORDER BY name ASC LIMIT 100',
        reasoning:
          'A pergunta pede uma listagem geral das acoes cadastradas, sem filtro por nome.',
      },
      {
        question: 'Mostre a TTWO',
        query:
          "SELECT id, name, \"marketShare\", \"createdAt\", \"updatedAt\" FROM financial_actions WHERE name ILIKE 'TTWO' ORDER BY name ASC LIMIT 100",
        reasoning:
          'A pergunta menciona explicitamente TTWO, entao a consulta filtra pelo nome.',
      },
      {
        question: 'Liste acoes com valor acima de 100',
        query:
          'SELECT id, name, "marketShare", "createdAt", "updatedAt" FROM financial_actions WHERE "marketShare" > 100 ORDER BY "marketShare" DESC LIMIT 100',
        reasoning:
          'A pergunta pede acoes cujo valor numerico associado seja maior que 100.',
      },
    ],
  });
};

export const getUserPromptTemplate = (input: {
  question: string;
  financialActions?: Array<{
    name: string;
    marketShare: number | null;
  }>;
}): string => {
  return JSON.stringify(input);
};
