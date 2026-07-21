import { z } from 'zod/v3';

export const IdentifyIntentionSchema = z.object({
  intention: z
    .enum(['stockDatabaseExecution', 'userDatabaseExecution', 'realTimeMarketShare', 'unknown'])
    .describe('The workflow path that should handle the user question'),
  route: z
    .enum(['stockDatabaseExecution', 'userDatabaseExecution', 'getRealTimeMarketShare', 'structuredResponse'])
    .describe('The graph node route that matches the selected intention'),
  databaseExecutionType: z
    .enum(['select', 'insert', 'update', 'delete'])
    .describe('The local database operation to execute when intention is databaseExecution; use select for read-only or non-database routes'),
  stocks: z
    .array(
      z.object({
        symbol: z
          .string()
          .nullable()
          .describe('Ticker symbol explicitly mentioned by the user, such as AAPL or TTWO; null when unknown'),
        name: z
          .string()
          .nullable()
          .describe('Company, asset, or stock name mentioned by the user; null when unknown'),
        exchange: z
          .string()
          .nullable()
          .describe('Exchange explicitly mentioned by the user, such as NASDAQ, NYSE, or B3; null when unknown'),
        investmentAmount: z
          .number()
          .nullable()
          .describe('Optional amount invested by the user; null when no amount is provided'),
        country: z
          .string()
          .nullable()
          .describe('Country explicitly associated with the stock; null when unknown'),
        currency: z
          .string()
          .nullable()
          .describe('Currency explicitly associated with the amount or stock; null when unknown'),
      }),
    )
    .describe('Stocks explicitly mentioned by the user'),
  userProfileUpdate: z
    .object({
      name: z.string().nullable().optional().describe('User name when explicitly provided'),
      type: z
        .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'])
        .nullable()
        .optional()
        .describe('User investor experience level when explicitly provided or strongly implied'),
      investmentHorizon: z
        .enum(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'])
        .nullable()
        .optional()
        .describe('User investment horizon when explicitly provided or strongly implied'),
      investmentStrategy: z
        .enum(['VALUE', 'GROWTH', 'DIVIDEND', 'QUALITY', 'MOMENTUM', 'PASSIVE', 'SPECULATIVE'])
        .nullable()
        .optional()
        .describe('User investment strategy when explicitly provided or strongly implied'),
    })
    .describe('User profile fields that can be persisted as long-term memory'),
  reasoning: z
    .string()
    .describe('Brief explanation of why the selected intention is the best route'),
});

export type IdentifyIntentionData = z.infer<typeof IdentifyIntentionSchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'Workflow Intention Router - Determine which path should handle the user question',
    output:
      'Return JSON with: intention, route, databaseExecutionType, stocks, userProfileUpdate, reasoning',
    inputContract: {
      currentMessage:
        'The latest user message. It may be a short answer to a previous assistant question.',
      recentConversation:
        'Recent turns from the same thread. Use it to resolve follow-up answers and complete previously requested fields.',
    },
    memoryPrinciples: [
      'Treat stable user facts as long-term memory candidates: name, investor experience level, investment horizon, and investment strategy',
      'Extract user profile updates even when the main request is about stocks',
      'Do not invent user profile values; infer only when the user statement strongly maps to one allowed enum',
      'Keep optional profile fields omitted or null when unknown',
      'When currentMessage is a short follow-up, combine it with recentConversation to preserve the original intent and previously extracted fields',
    ],
    intentions: [
      {
        value: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        description:
          'Use when the question can be answered by querying or changing the internal stocks database.',
      },
      {
        value: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        description:
          'Use when the user wants to provide, see, or change profile information used as long-term memory.',
      },
      {
        value: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        description:
          'Use when the question requires current external market, quote, competitor, market share, or real-time information that is not guaranteed to exist in the internal database.',
      },
      {
        value: 'unknown',
        route: 'structuredResponse',
        description:
          'Use when the question is ambiguous, outside the known flows, or cannot be confidently mapped to stock, user, or real-time market data.',
      },
    ],
    userEnums: {
      type: {
        BEGINNER: 'new investor, learning basics, little experience',
        INTERMEDIATE: 'has some experience and understands common investment concepts',
        ADVANCED: 'experienced investor with strong autonomy',
        PROFESSIONAL: 'works professionally with investing or financial markets',
      },
      investmentHorizon: {
        SHORT_TERM: 'days to months',
        MEDIUM_TERM: 'months to a few years',
        LONG_TERM: 'several years or retirement-style horizon',
      },
      investmentStrategy: {
        VALUE: 'undervalued companies',
        GROWTH: 'high growth companies',
        DIVIDEND: 'income and dividends',
        QUALITY: 'financially strong companies',
        MOMENTUM: 'trend or price momentum',
        PASSIVE: 'indexes, ETFs, buy-and-hold allocation',
        SPECULATIVE: 'high risk and high uncertainty bets',
      },
    },
    rules: [
      'Return exactly one intention: stockDatabaseExecution, userDatabaseExecution, realTimeMarketShare, or unknown',
      'route must match intention: stockDatabaseExecution -> stockDatabaseExecution, userDatabaseExecution -> userDatabaseExecution, realTimeMarketShare -> getRealTimeMarketShare, unknown -> structuredResponse',
      'Classify databaseExecutionType as select for reads, reports, analytics, comparisons, searches, and questions; insert for creating/registering; update for changing/editing; delete for removing/deleting',
      'Use databaseExecutionType select when intention is realTimeMarketShare or unknown',
      'Prefer userDatabaseExecution when the user is answering onboarding questions or asks to change/view their profile',
      'Prefer stockDatabaseExecution for portfolio persistence, stored stock searches, inserting stocks, updating investment amounts, or deleting stocks',
      'Prefer realTimeMarketShare for current prices, quotes, market conditions, competitors, market share, external positioning, or real-time public information',
      'Extract stocks for every explicit stock, ticker, company, or listed asset the user mentions',
      'For follow-up answers like "e na B3", "bolsa B3", "NASDAQ", or "NYSE", use the most recent stock mentioned in recentConversation and fill only the exchange',
      'For follow-up answers like "R$ 350", "US$ 200", or "350,36", use the most recent stock operation in recentConversation and fill only investmentAmount',
      'For follow-up answers like "WEGE3 SA", "Take-Two Interactive", or a company name after the assistant asked for the stock name, use the most recent stock mentioned in recentConversation and fill only name',
      'For follow-up profile answers like "sou iniciante", "longo prazo", "dividendos", or "meu nome e Diego", use recentConversation to keep the user profile completion route and fill the matching userProfileUpdate field',
      'If recentConversation contains a pending stock insert/update and currentMessage provides a missing field, keep intention as stockDatabaseExecution and databaseExecutionType as the pending operation',
      'If recentConversation contains pending user profile completion and currentMessage provides a missing profile field, keep intention as userDatabaseExecution and databaseExecutionType as update',
      'Do not ask again for a field that the currentMessage clearly answers',
      'Do not extract generic category words as stock names, such as "acoes", "ativos", "carteira", "portfolio", "investimentos", "empresas", or "minhas acoes"',
      'For broad portfolio questions like "minhas acoes", "quais acoes tenho", or "liste meus ativos", return stocks as an empty array',
      'stocks[].investmentAmount must contain the numeric amount explicitly tied to that stock when the user writes currency, amount, contribution, position, or allocation',
      'For currency values like US$200, $200, R$ 200, or 200 dolares, return only the numeric value, for example 200',
      'Use uppercase ticker-like stock symbols',
      'stocks must be an empty array when no stock is mentioned',
      'Keep reasoning brief and in the SAME language as the user question',
      'Do not answer the user question; only classify the workflow intention and extract durable fields',
    ],
    examples: [
      {
        input: {
          recentConversation:
            'usuario: Adicione WEGE3 com R$ 350,36\nassistente: Consigo cadastrar WEGE3 com R$ 350,36. So me diga a bolsa onde ele e negociado.',
          currentMessage: 'E na bolsa B3',
        },
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        databaseExecutionType: 'insert',
        stocks: [
          {
            symbol: 'WEGE3',
            name: null,
            exchange: 'B3',
            investmentAmount: 350.36,
            country: null,
            currency: 'BRL',
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A mensagem atual completa a bolsa do ativo WEGE3 citado anteriormente.',
      },
      {
        input: {
          recentConversation:
            'usuario: Bom dia\nassistente: Para adaptar melhor as respostas, me diga seu nome, experiencia, horizonte e estrategia.',
          currentMessage: 'Sou iniciante e penso no longo prazo',
        },
        intention: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        databaseExecutionType: 'update',
        stocks: [],
        userProfileUpdate: {
          type: 'BEGINNER',
          investmentHorizon: 'LONG_TERM',
        },
        reasoning:
          'A mensagem atual responde parte do perfil solicitado anteriormente.',
      },
      {
        question: 'Meu nome e Diego, sou iniciante e invisto para longo prazo com foco em dividendos',
        intention: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        databaseExecutionType: 'update',
        stocks: [],
        userProfileUpdate: {
          name: 'Diego',
          type: 'BEGINNER',
          investmentHorizon: 'LONG_TERM',
          investmentStrategy: 'DIVIDEND',
        },
        reasoning:
          'A mensagem fornece dados persistentes do perfil do usuario.',
      },
      {
        question: 'Quais sao minhas acoes?',
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        databaseExecutionType: 'select',
        stocks: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta pede uma consulta geral das acoes cadastradas no banco, sem mencionar um ticker especifico.',
      },
      {
        question: 'Adicione a acao TTWO da Take-Two na NASDAQ por US$200',
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        databaseExecutionType: 'insert',
        stocks: [
          {
            symbol: 'TTWO',
            name: 'Take-Two',
            exchange: 'NASDAQ',
            investmentAmount: 200,
            country: null,
            currency: 'USD',
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A pergunta solicita registrar uma nova acao no banco e informa campos basicos do ativo.',
      },
      {
        question: 'Atualize minha estrategia para value e meu horizonte para medio prazo',
        intention: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        databaseExecutionType: 'update',
        stocks: [],
        userProfileUpdate: {
          investmentHorizon: 'MEDIUM_TERM',
          investmentStrategy: 'VALUE',
        },
        reasoning:
          'A pergunta solicita atualizacao de dados persistentes do usuario.',
      },
      {
        question: 'Compare o market share atual da Apple e da Microsoft',
        intention: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        databaseExecutionType: 'select',
        stocks: [
          {
            symbol: null,
            name: 'Apple',
            exchange: null,
            investmentAmount: null,
            country: null,
            currency: null,
          },
          {
            symbol: null,
            name: 'Microsoft',
            exchange: null,
            investmentAmount: null,
            country: null,
            currency: null,
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A pergunta depende de informacoes atuais de mercado e concorrencia fora do banco interno.',
      },
    ],
  });
};

export const getUserPromptTemplate = (input: {
  currentMessage: string;
  recentConversation: string;
}): string => {
  return JSON.stringify(input);
};
