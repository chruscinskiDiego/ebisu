import { z } from 'zod/v3';

export const IdentifyIntentionSchema = z.object({
  intention: z
    .enum(['stockDatabaseExecution', 'cryptoDatabaseExecution', 'userDatabaseExecution', 'realTimeMarketShare', 'unknown'])
    .describe('The workflow path that should handle the user question'),
  route: z
    .enum(['stockDatabaseExecution', 'cryptoDatabaseExecution', 'userDatabaseExecution', 'getRealTimeMarketShare', 'structuredResponse'])
    .describe('The graph node route that matches the selected intention'),
  workflowTasks: z
    .array(
      z.object({
        intention: z
          .enum(['stockDatabaseExecution', 'cryptoDatabaseExecution', 'userDatabaseExecution', 'realTimeMarketShare', 'unknown'])
          .describe('One workflow action requested by the user'),
        route: z
          .string()
          .min(1)
          .describe('Graph node route for this task'),
        databaseExecutionType: z
          .enum(['select', 'insert', 'update', 'delete'])
          .optional()
          .describe('Database operation for this task when applicable'),
        assetTypes: z
          .array(z.enum(['stock', 'crypto']))
          .optional()
          .describe('Asset classes handled by a real-time market data task'),
        description: z.string().optional().describe('Brief description of this requested task'),
      }),
    )
    .describe('All workflow tasks requested by the user, in execution order'),
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
  cryptos: z
    .array(
      z.object({
        symbol: z
          .string()
          .nullable()
          .describe('Cryptocurrency symbol explicitly mentioned by the user, such as BTC or ETH; null when unknown'),
        name: z
          .string()
          .nullable()
          .describe('Cryptocurrency name mentioned by the user; null when unknown'),
        investmentAmount: z
          .number()
          .nullable()
          .describe('Optional amount invested by the user; null when no amount is provided'),
        currency: z
          .string()
          .nullable()
          .describe('Quote currency for the investment; use USDT for persisted cryptocurrencies'),
      }),
    )
    .describe('Cryptocurrencies explicitly mentioned by the user'),
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
      'Return JSON with: intention, route, workflowTasks, databaseExecutionType, stocks, cryptos, userProfileUpdate, reasoning',
    inputContract: {
      currentMessage:
        'The latest user message. It may be a short answer to a previous assistant question.',
      recentConversation:
        'Recent turns from the same thread. Use it to resolve follow-up answers and complete previously requested fields.',
    },
    memoryPrinciples: [
      'Treat stable user facts as long-term memory candidates: name, investor experience level, investment horizon, and investment strategy',
      'Extract user profile updates even when the main request is about stocks or cryptocurrencies',
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
        value: 'cryptoDatabaseExecution',
        route: 'cryptoDatabaseExecution',
        description:
          'Use when the question can be answered by querying or changing the internal cryptocurrencies database.',
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
          'Use when the question is ambiguous, outside the known flows, or cannot be confidently mapped to stock, cryptocurrency, user, or real-time market data.',
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
      'Return exactly one intention: stockDatabaseExecution, cryptoDatabaseExecution, userDatabaseExecution, realTimeMarketShare, or unknown',
      'route must match intention: stockDatabaseExecution -> stockDatabaseExecution, cryptoDatabaseExecution -> cryptoDatabaseExecution, userDatabaseExecution -> userDatabaseExecution, realTimeMarketShare -> getRealTimeMarketShare, unknown -> structuredResponse',
      'workflowTasks must include every distinct action requested by the user',
      'For a simple request, workflowTasks must contain one task matching intention and route',
      'For a compound request, workflowTasks must contain multiple tasks in execution order',
      'Use exactly one realTimeMarketShare task when one request asks for current prices of multiple assets or asset classes; set assetTypes to every requested class so the node can run its quote subtasks in parallel',
      'For every realTimeMarketShare task, set assetTypes to stock, crypto, or both according to the requested current market data',
      'When the user asks to add/update/delete a stock and also get current price, quote, market share, competitor, or real-time market information for it, include stockDatabaseExecution first and realTimeMarketShare second',
      'When the user asks to add/update/delete a cryptocurrency and also get its current price, include cryptoDatabaseExecution first and realTimeMarketShare second',
      'When the user asks for more than one persistence action involving stocks and cryptocurrencies, include one task for each asset type in the order requested',
      'When the user asks to update profile information and also perform a stock, cryptocurrency, or market task, include userDatabaseExecution and every other task',
      'When the user asks for current prices or market values of "my stocks", "minhas acoes", "minha carteira", or similar portfolio references without naming tickers, include realTimeMarketShare with stocks as an empty array',
      'When the user asks for current prices of "minhas criptomoedas" or "minhas criptos" without naming symbols, include realTimeMarketShare with cryptos as an empty array and assetTypes containing crypto',
      'Each workflowTasks item must use databaseExecutionType when its route is stockDatabaseExecution, cryptoDatabaseExecution, or userDatabaseExecution',
      'Use current graph routes in workflowTasks.route. Existing routes are userDatabaseExecution, stockDatabaseExecution, cryptoDatabaseExecution, getRealTimeMarketShare, and structuredResponse',
      'Classify databaseExecutionType as select for reads, reports, analytics, comparisons, searches, and questions; insert for creating/registering; update for changing/editing; delete for removing/deleting',
      'Use databaseExecutionType select when intention is realTimeMarketShare or unknown',
      'Prefer userDatabaseExecution when the user is answering onboarding questions or asks to change/view their profile',
      'Prefer stockDatabaseExecution for portfolio persistence, stored stock searches, inserting stocks, updating investment amounts, or deleting stocks',
      'Prefer cryptoDatabaseExecution for portfolio persistence, stored cryptocurrency searches, inserting cryptocurrencies, updating their investment amounts, or deleting cryptocurrencies',
      'Prefer realTimeMarketShare for current prices, quotes, market conditions, competitors, market share, external positioning, or real-time public information',
      'Extract stocks for every explicit stock, ticker, company, or listed asset the user mentions',
      'Extract cryptos for every explicit cryptocurrency, crypto symbol, or cryptocurrency name the user mentions',
      'Never place a cryptocurrency in stocks or a stock in cryptos',
      'For follow-up answers like "e na B3", "bolsa B3", "NASDAQ", or "NYSE", use the most recent stock mentioned in recentConversation and fill only the exchange',
      'For follow-up answers like "R$ 350", "US$ 200", or "350,36", use the most recent stock operation in recentConversation and fill only investmentAmount',
      'For follow-up answers like "WEGE3 SA", "Take-Two Interactive", or a company name after the assistant asked for the stock name, use the most recent stock mentioned in recentConversation and fill only name',
      'For cryptocurrency follow-up answers like "Bitcoin" after the assistant asked for the cryptocurrency name, use the most recent cryptocurrency mentioned in recentConversation and fill only name',
      'For a cryptocurrency investment amount follow-up, use the most recent cryptocurrency operation in recentConversation and set currency to USDT',
      'For follow-up profile answers like "sou iniciante", "longo prazo", "dividendos", or "meu nome e Diego", use recentConversation to keep the user profile completion route and fill the matching userProfileUpdate field',
      'If recentConversation contains a pending stock insert/update and currentMessage provides a missing field, keep intention as stockDatabaseExecution and databaseExecutionType as the pending operation',
      'If recentConversation contains a pending cryptocurrency insert/update and currentMessage provides a missing field, keep intention as cryptoDatabaseExecution and databaseExecutionType as the pending operation',
      'If recentConversation contains pending user profile completion and currentMessage provides a missing profile field, keep intention as userDatabaseExecution and databaseExecutionType as update',
      'Do not ask again for a field that the currentMessage clearly answers',
      'Do not extract generic category words as stock names, such as "acoes", "ativos", "carteira", "portfolio", "investimentos", "empresas", or "minhas acoes"',
      'For broad portfolio questions like "minhas acoes", "quais acoes tenho", or "liste meus ativos", return stocks as an empty array',
      'stocks[].investmentAmount must contain the numeric amount explicitly tied to that stock when the user writes currency, amount, contribution, position, or allocation',
      'For broad cryptocurrency questions like "minhas criptomoedas" or "quais criptos tenho", return cryptos as an empty array',
      'For broad stored-portfolio questions like "liste meus ativos" or "o que tenho na carteira" that do not specify an asset class, include a stockDatabaseExecution select task followed by a cryptoDatabaseExecution select task',
      'cryptos[].investmentAmount must contain the numeric amount explicitly tied to that cryptocurrency when the user writes amount, contribution, position, or allocation',
      'Use USDT as cryptos[].currency for cryptocurrency persistence operations',
      'For currency values like US$200, $200, R$ 200, or 200 dolares, return only the numeric value, for example 200',
      'Use uppercase ticker-like stock symbols',
      'Use uppercase cryptocurrency symbols',
      'stocks must be an empty array when no stock is mentioned',
      'cryptos must be an empty array when no cryptocurrency is mentioned',
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
        workflowTasks: [
          {
            intention: 'stockDatabaseExecution',
            route: 'stockDatabaseExecution',
            databaseExecutionType: 'insert',
            description: 'Completar e cadastrar WEGE3 na carteira',
          },
        ],
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
        cryptos: [],
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
        workflowTasks: [
          {
            intention: 'userDatabaseExecution',
            route: 'userDatabaseExecution',
            databaseExecutionType: 'update',
            description: 'Completar preferencias do usuario',
          },
        ],
        databaseExecutionType: 'update',
        stocks: [],
        cryptos: [],
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
        workflowTasks: [
          {
            intention: 'userDatabaseExecution',
            route: 'userDatabaseExecution',
            databaseExecutionType: 'update',
            description: 'Atualizar preferencias do usuario',
          },
        ],
        databaseExecutionType: 'update',
        stocks: [],
        cryptos: [],
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
        workflowTasks: [
          {
            intention: 'stockDatabaseExecution',
            route: 'stockDatabaseExecution',
            databaseExecutionType: 'select',
            description: 'Consultar as acoes da carteira',
          },
        ],
        databaseExecutionType: 'select',
        stocks: [],
        cryptos: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta pede uma consulta geral das acoes cadastradas no banco, sem mencionar um ticker especifico.',
      },
      {
        question: 'Quais sao minhas criptomoedas?',
        intention: 'cryptoDatabaseExecution',
        route: 'cryptoDatabaseExecution',
        workflowTasks: [
          {
            intention: 'cryptoDatabaseExecution',
            route: 'cryptoDatabaseExecution',
            databaseExecutionType: 'select',
            description: 'Consultar as criptomoedas da carteira',
          },
        ],
        databaseExecutionType: 'select',
        stocks: [],
        cryptos: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta pede uma consulta geral das criptomoedas cadastradas, sem mencionar um simbolo especifico.',
      },
      {
        question: 'Adicione BTC, Bitcoin, com 250 USDT',
        intention: 'cryptoDatabaseExecution',
        route: 'cryptoDatabaseExecution',
        workflowTasks: [
          {
            intention: 'cryptoDatabaseExecution',
            route: 'cryptoDatabaseExecution',
            databaseExecutionType: 'insert',
            description: 'Cadastrar BTC na carteira',
          },
        ],
        databaseExecutionType: 'insert',
        stocks: [],
        cryptos: [
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            investmentAmount: 250,
            currency: 'USDT',
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A pergunta solicita registrar Bitcoin na carteira de criptomoedas.',
      },
      {
        input: {
          recentConversation:
            'usuario: Adicione BTC com 250 USDT\nassistente: Consigo continuar com BTC e 250 USDT. So me diga o nome da criptomoeda.',
          currentMessage: 'Bitcoin',
        },
        intention: 'cryptoDatabaseExecution',
        route: 'cryptoDatabaseExecution',
        workflowTasks: [
          {
            intention: 'cryptoDatabaseExecution',
            route: 'cryptoDatabaseExecution',
            databaseExecutionType: 'insert',
            description: 'Completar e cadastrar BTC na carteira',
          },
        ],
        databaseExecutionType: 'insert',
        stocks: [],
        cryptos: [
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            investmentAmount: 250,
            currency: 'USDT',
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A mensagem atual completa o nome da criptomoeda BTC citada anteriormente.',
      },
      {
        question: 'Liste minhas acoes e criptomoedas',
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        workflowTasks: [
          {
            intention: 'stockDatabaseExecution',
            route: 'stockDatabaseExecution',
            databaseExecutionType: 'select',
            description: 'Consultar as acoes da carteira',
          },
          {
            intention: 'cryptoDatabaseExecution',
            route: 'cryptoDatabaseExecution',
            databaseExecutionType: 'select',
            description: 'Consultar as criptomoedas da carteira',
          },
        ],
        databaseExecutionType: 'select',
        stocks: [],
        cryptos: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta combina consultas das duas classes de ativos persistidas.',
      },
      {
        question: 'Adicione a acao TTWO da Take-Two na NASDAQ por US$200',
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        workflowTasks: [
          {
            intention: 'stockDatabaseExecution',
            route: 'stockDatabaseExecution',
            databaseExecutionType: 'insert',
            description: 'Cadastrar TTWO na carteira',
          },
        ],
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
        cryptos: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta solicita registrar uma nova acao no banco e informa campos basicos do ativo.',
      },
      {
        question: 'Adicione a acao TTWO da Take-Two na NASDAQ por US$200 e consulte o valor em tempo real dela',
        intention: 'stockDatabaseExecution',
        route: 'stockDatabaseExecution',
        workflowTasks: [
          {
            intention: 'stockDatabaseExecution',
            route: 'stockDatabaseExecution',
            databaseExecutionType: 'insert',
            description: 'Cadastrar TTWO na carteira',
          },
          {
            intention: 'realTimeMarketShare',
            route: 'getRealTimeMarketShare',
            databaseExecutionType: 'select',
            description: 'Consultar informacao em tempo real sobre TTWO',
          },
        ],
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
        cryptos: [],
        userProfileUpdate: {},
        reasoning:
          'A pergunta combina cadastro de acao com consulta de mercado em tempo real sobre o mesmo ativo.',
      },
      {
        question: 'Atualize minha estrategia para value e meu horizonte para medio prazo',
        intention: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        workflowTasks: [
          {
            intention: 'userDatabaseExecution',
            route: 'userDatabaseExecution',
            databaseExecutionType: 'update',
            description: 'Atualizar preferencias do usuario',
          },
        ],
        databaseExecutionType: 'update',
        stocks: [],
        cryptos: [],
        userProfileUpdate: {
          investmentHorizon: 'MEDIUM_TERM',
          investmentStrategy: 'VALUE',
        },
        reasoning:
          'A pergunta solicita atualizacao de dados persistentes do usuario.',
      },
      {
        question: 'Atualize meu nome para Diego e veja os valores atuais das minhas acoes no mercado financeiro',
        intention: 'userDatabaseExecution',
        route: 'userDatabaseExecution',
        workflowTasks: [
          {
            intention: 'userDatabaseExecution',
            route: 'userDatabaseExecution',
            databaseExecutionType: 'update',
            description: 'Atualizar o nome do usuario',
          },
          {
            intention: 'realTimeMarketShare',
            route: 'getRealTimeMarketShare',
            databaseExecutionType: 'select',
            description: 'Consultar cotacoes atuais da carteira cadastrada',
          },
        ],
        databaseExecutionType: 'update',
        stocks: [],
        cryptos: [],
        userProfileUpdate: {
          name: 'Diego',
        },
        reasoning:
          'A pergunta combina atualizacao do perfil com consulta em tempo real dos ativos cadastrados.',
      },
      {
        question: 'Consulte os valores atuais de AAPL, BTC e ETH',
        intention: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        workflowTasks: [
          {
            intention: 'realTimeMarketShare',
            route: 'getRealTimeMarketShare',
            databaseExecutionType: 'select',
            assetTypes: ['stock', 'crypto'],
            description: 'Consultar em paralelo as cotacoes de AAPL, BTC e ETH',
          },
        ],
        databaseExecutionType: 'select',
        stocks: [
          {
            symbol: 'AAPL',
            name: 'Apple',
            exchange: 'NASDAQ',
            investmentAmount: null,
            country: null,
            currency: 'USD',
          },
        ],
        cryptos: [
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            investmentAmount: null,
            currency: 'USDT',
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            investmentAmount: null,
            currency: 'USDT',
          },
        ],
        userProfileUpdate: {},
        reasoning:
          'A pergunta pede cotacoes atuais de uma acao e duas criptomoedas.',
      },
      {
        question: 'Compare o market share atual da Apple e da Microsoft',
        intention: 'realTimeMarketShare',
        route: 'getRealTimeMarketShare',
        workflowTasks: [
          {
            intention: 'realTimeMarketShare',
            route: 'getRealTimeMarketShare',
            databaseExecutionType: 'select',
            assetTypes: ['stock'],
            description: 'Consultar market share atual',
          },
        ],
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
        cryptos: [],
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
