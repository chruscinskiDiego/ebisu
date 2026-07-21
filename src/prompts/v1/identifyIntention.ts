import { z } from 'zod/v3';

export const IdentifyIntentionSchema = z.object({
  intention: z
    .enum(['databaseExecution', 'realTimeMarketShare', 'unknown'])
    .describe('The workflow path that should handle the user question'),
  route: z
    .enum(['databaseExecution', 'getRealTimeMarketShare', 'structuredResponse'])
    .describe('The graph node route that matches the selected intention'),
  databaseExecutionType: z
    .enum(['select', 'insert', 'update', 'delete'])
    .describe('The local database operation to execute when intention is databaseExecution; use select for read-only or non-database routes'),
  financialActions: z
    .array(
      z.object({
        name: z
          .string()
          .describe('Name of the company, asset, competitor, course, product, or financial entity mentioned by the user'),
        marketShare: z
          .number()
          .nullable()
          .describe('Numeric value explicitly associated with the financial action, such as market share percentage or monetary amount; null when no numeric value is provided'),
      }),
    )
    .describe('Financial or market entities explicitly mentioned by the user, with the numeric action value when available'),
  reasoning: z
    .string()
    .describe('Brief explanation of why the selected intention is the best route'),
});

export type IdentifyIntentionData = z.infer<typeof IdentifyIntentionSchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'Workflow Intention Router - Determine which path should handle the user question',
    output:
      'Return JSON with: intention, route, databaseExecutionType, financialActions, reasoning',
    intentions: [
      {
        value: 'databaseExecution',
        route: 'databaseExecution',
        description:
          'Use when the question can be answered by querying or changing internal database data, including sales, revenue, courses, students, customers, enrollments, payments, and stored analytics.',
      },
      {
        value: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        description:
          'Use when the question requires current external market, competitor, market share, or real-time information that is not guaranteed to exist in the internal database.',
      },
      {
        value: 'unknown',
        route: 'structuredResponse',
        description:
          'Use when the question is ambiguous, outside the known flows, or cannot be confidently mapped to databaseExecution or realTimeMarketShare.',
      },
    ],
    rules: [
      'Return exactly one intention: databaseExecution, realTimeMarketShare, or unknown',
      'route must match intention: databaseExecution -> databaseExecution, realTimeMarketShare -> getRealTimeMarketShare, unknown -> structuredResponse',
      'Classify databaseExecutionType as select for reads, reports, analytics, comparisons, searches, and questions; insert for creating/registering; update for changing/editing; delete for removing/deleting',
      'Use databaseExecutionType select when intention is realTimeMarketShare or unknown',
      'Extract financialActions for every explicit company, competitor, asset, product, course, or financial entity the user mentions',
      'financialActions[].marketShare must contain the numeric value explicitly tied to that entity/action, even when the user writes it as currency, price, amount, percentage, share, or allocation',
      'For currency values like US$200, $200, R$ 200, or 200 dolares, return only the numeric value, for example 200',
      'For percentage values like 24.5%, return only the numeric value, for example 24.5',
      'Use null only when the user mentions the entity but provides no numeric value for it',
      'financialActions must be an empty array when no entity/action is mentioned',
      'Prefer databaseExecution for questions about internal business data, stored metrics, historical sales, courses, students, customers, payments, or database operations',
      'Prefer realTimeMarketShare for questions about current market conditions, competitors, market share, external positioning, or real-time public information',
      'Use unknown when the request is unclear, too broad, unrelated to the available flows, or missing enough context to choose a route',
      'Keep reasoning brief and in the SAME language as the user question',
      'Do not answer the user question; only classify the workflow intention',
    ],
    examples: [
      {
        question: 'Qual foi a receita total por curso no ultimo mes?',
        intention: 'databaseExecution',
        route: 'databaseExecution',
        databaseExecutionType: 'select',
        financialActions: [
          {
            name: 'curso',
            marketShare: null,
          },
        ],
        reasoning:
          'A pergunta pede uma metrica interna de receita por curso armazenada no banco de dados.',
      },
      {
        question: 'Compare nosso market share atual com os principais concorrentes',
        intention: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        databaseExecutionType: 'select',
        financialActions: [
          {
            name: 'principais concorrentes',
            marketShare: null,
          },
        ],
        reasoning:
          'A pergunta depende de informacoes atuais de mercado e concorrencia fora do banco interno.',
      },
      {
        question: 'Atualize a Apple com market share de 24.5% e a Microsoft com 19%',
        intention: 'databaseExecution',
        route: 'databaseExecution',
        databaseExecutionType: 'update',
        financialActions: [
          {
            name: 'Apple',
            marketShare: 24.5,
          },
          {
            name: 'Microsoft',
            marketShare: 19,
          },
        ],
        reasoning:
          'A pergunta solicita atualizacao de dados locais e informa percentuais explicitos de market share.',
      },
      {
        question: 'Adicione a acao TTWO por US$200',
        intention: 'databaseExecution',
        route: 'databaseExecution',
        databaseExecutionType: 'insert',
        financialActions: [
          {
            name: 'TTWO',
            marketShare: 200,
          },
        ],
        reasoning:
          'A pergunta solicita registrar uma nova acao no banco e informa o valor monetario explicitamente associado a TTWO.',
      },
      {
        question: 'Me ajude a planejar uma viagem para julho',
        intention: 'unknown',
        route: 'structuredResponse',
        databaseExecutionType: 'select',
        financialActions: [],
        reasoning:
          'A pergunta nao se relaciona com dados internos nem com analise de market share.',
      },
    ],
  });
};

export const getUserPromptTemplate = (question: string): string => {
  return question;
};
