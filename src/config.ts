export const config = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? '',
  xTitle: process.env.OPENROUTER_X_TITLE ?? 'IA Devs - Sales Analytics Reporter',
  models: [
    //'nvidia/llama-nemotron-rerank-vl-1b-v2:free'
    //'cohere/north-mini-code:free',
    'z-ai/glm-5.2'
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: 0.7,
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DATABASE ?? 'ebisu',
    ssl: process.env.POSTGRES_SSL === 'true',
    synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
    logging: process.env.TYPEORM_LOGGING === 'true',
    migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
  },
  fmp: {
    base_url: 'https://financialmodelingprep.com/stable/',
    api_key: process.env.FMP_API_KEY ?? '',
  },
  binance: {
    base_url:
      process.env.BINANCE_MARKET_DATA_BASE_URL ??
      'https://data-api.binance.vision/api/v3/',
  },
  maxCorrectionAttempts: 1,
  maxSubQuestions: 3,
};


export default config
