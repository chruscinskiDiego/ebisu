# Ebisu — financial agent with LangGraph

Experimental TypeScript agent that identifies a question's intent, routes operations to financial data sources and uses a language model to structure the response.

## Agent workflow

1. Identifies the message intent.
2. Routes to financial database operations, market quotes or a direct response.
3. Produces a structured final response.

## Technologies

LangGraph, LangChain, TypeScript, Zod, TypeORM and PostgreSQL. Model integration uses OpenRouter; market queries use Financial Modeling Prep.

## Run locally

Requires Node.js, npm and Docker Compose.

```bash
npm ci
cp .env.example .env
# Configure the model key, database and FMP_API_KEY for market queries.
docker compose up -d
npm start
```

The agent graph is exported from src/agent/graph.ts and registered in langgraph.json. Check the model in src/config.ts and its support for the structured responses used here.

## Database

A migration is provided in src/database/migrations/. Set TYPEORM_* options for your development environment and apply the migration before using tables that do not yet exist. Do not enable automatic synchronization on production data.

## Structure

- `src/agent/`: state, graph and nodes.
- `src/database/`: entities, migration and repositories.
- `src/prompts/`: workflow instructions.
- `src/services/`: financial operations and model client.

## Scope and validation

Experimental project with external service dependencies. Use a development database when exploring model-directed queries. Test scripts and workflows exist, but the current tree has no .test.ts files; configuration alone does not establish test coverage. The test:all script also refers to lint:langgraph, which is not defined in the manifest.

## License

See [LICENSE](LICENSE).
