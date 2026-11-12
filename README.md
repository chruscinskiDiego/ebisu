# Ebisu — agente financeiro com LangGraph

Protótipo de agente em TypeScript que identifica a intenção de uma pergunta, encaminha operações para dados financeiros e organiza a resposta com ajuda de um modelo de linguagem.

## Fluxo do agente

1. Identifica a intenção da mensagem.
2. Encaminha para consulta de dados financeiros, cotação de mercado ou resposta direta.
3. Produz a resposta final estruturada.

## Tecnologias

LangGraph, LangChain, TypeScript, Zod, TypeORM e PostgreSQL. A integração de modelos usa OpenRouter; consultas de mercado usam Financial Modeling Prep.

## Executar localmente

Requer Node.js, npm e Docker Compose.

```bash
npm ci
cp .env.example .env
# Configure a chave do modelo, o banco e, para cotações, FMP_API_KEY.
docker compose up -d
npm start
```

O grafo agent é exportado por src/agent/graph.ts e registrado em langgraph.json. Confira o modelo em src/config.ts e se ele suporta as saídas estruturadas utilizadas.

## Banco de dados

O repositório possui uma migration em src/database/migrations/. Defina as opções TYPEORM_* de acordo com seu banco de desenvolvimento; a migration precisa ser aplicada antes de usar tabelas ainda não criadas. Não habilite sincronização automática sobre dados de produção.

## Organização

- `src/agent/`: estado, grafo e nós.
- `src/database/`: entidades, migration e repositórios.
- `src/prompts/`: instruções dos fluxos.
- `src/services/`: operações financeiras e cliente de modelos.

## Escopo e validação

Projeto experimental, dependente de serviços externos. Use uma base de desenvolvimento ao explorar execução de consultas orientada por modelos. Existem scripts e workflows de testes, mas a árvore atual não contém arquivos .test.ts; a existência da configuração não comprova cobertura. O script test:all também referencia lint:langgraph, que não está definido no manifesto.

## Licença

Consulte [LICENSE](LICENSE).
