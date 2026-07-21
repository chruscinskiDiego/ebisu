import { DatabaseExecutionType, Stock } from '../agent/schemas/message.schema.ts';
import { initializeDataSource } from '../database/dataSource.ts';
import { StockEntity } from '../database/entities/stock.entity.ts';
import {
  StockInput,
  StockRepository,
} from '../database/repositories/stockRepository.ts';
import {
  StockSelectQuerySchema,
  getSystemPrompt as getSelectQuerySystemPrompt,
  getUserPromptTemplate as getSelectQueryUserPromptTemplate,
} from '../prompts/v1/stockSelectQuery.ts';
import { OpenRouterService } from './openrouterService.ts';

export type StockExecutionResult = {
  operation: DatabaseExecutionType;
  template: string;
  summary: string;
  records?: StockEntity[];
  rows?: Record<string, unknown>[];
  query?: string;
  affected?: number;
  missingSymbols?: string[];
  missingStockFields?: Record<string, string[]>;
  insertedSymbols?: string[];
  updatedSymbols?: string[];
};

export const StockOperationTemplates: Record<
  DatabaseExecutionType,
  {
    template: string;
    requiresStocks: boolean;
  }
> = {
  select: {
    template: 'stock_select',
    requiresStocks: false,
  },
  insert: {
    template: 'stock_insert',
    requiresStocks: true,
  },
  update: {
    template: 'stock_update',
    requiresStocks: true,
  },
  delete: {
    template: 'stock_delete',
    requiresStocks: true,
  },
};

const REQUIRED_STOCK_INSERT_FIELDS = ['symbol', 'exchange'] as const;

const forbiddenSelectTokens = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'truncate',
  'create',
  'grant',
  'revoke',
  'merge',
  'call',
  'execute',
  'begin',
  'commit',
  'rollback',
  'join',
];

const stockLabel = (stock: Stock, index: number): string => {
  return stock.symbol?.trim() || stock.name?.trim() || `stock_${index + 1}`;
};

const validateRequiredStockInsertFields = (
  stocks: Stock[] = [],
): Record<string, string[]> => {
  return stocks.reduce<Record<string, string[]>>((missingFieldsByStock, stock, index) => {
    const missingFields = REQUIRED_STOCK_INSERT_FIELDS.filter((field) => {
      const value = stock[field];
      return typeof value !== 'string' || !value.trim();
    });

    if (missingFields.length > 0) {
      missingFieldsByStock[stockLabel(stock, index)] = [...missingFields];
    }

    return missingFieldsByStock;
  }, {});
};

const validateSymbolFields = (stocks: Stock[] = []): Record<string, string[]> => {
  return stocks.reduce<Record<string, string[]>>((missingFieldsByStock, stock, index) => {
    if (!stock.symbol?.trim()) {
      missingFieldsByStock[stockLabel(stock, index)] = ['symbol'];
    }

    return missingFieldsByStock;
  }, {});
};

const normalizeStocks = (stocks: Stock[] = []): StockInput[] => {
  return stocks.map((stock) => ({
    symbol: stock.symbol?.trim().toUpperCase() ?? '',
    name: stock.name?.trim() || stock.symbol?.trim().toUpperCase() || undefined,
    exchange: stock.exchange?.trim().toUpperCase() || undefined,
    investmentAmount: stock.investmentAmount ?? undefined,
    country: stock.country?.trim() || undefined,
    currency: stock.currency?.trim().toUpperCase() || undefined,
  }));
};

const ensureSafeStockSelectQuery = (query: string): string => {
  const trimmedQuery = query.trim().replace(/;+\s*$/, '');

  if (!trimmedQuery.toLowerCase().startsWith('select ')) {
    throw new Error('Apenas queries SELECT sao permitidas.');
  }

  if (/[;]/.test(trimmedQuery) || /--|\/\*/.test(trimmedQuery)) {
    throw new Error('A query SELECT nao pode conter multiplos comandos ou comentarios.');
  }

  if (!/\bfrom\s+stocks\b/i.test(trimmedQuery)) {
    throw new Error('A query SELECT deve usar somente a tabela stocks.');
  }

  if (/\bfrom\s+(?!stocks\b)[a-zA-Z_][\w.]*/i.test(trimmedQuery)) {
    throw new Error('A query SELECT referencia uma tabela nao permitida.');
  }

  const hasForbiddenToken = forbiddenSelectTokens.some((token) =>
    new RegExp(`\\b${token}\\b`, 'i').test(trimmedQuery),
  );

  if (hasForbiddenToken) {
    throw new Error('A query SELECT contem operacao ou clausula nao permitida.');
  }

  if (!/\blimit\s+\d+\b/i.test(trimmedQuery)) {
    return `${trimmedQuery} LIMIT 100`;
  }

  return trimmedQuery;
};

export class StockService {
  constructor(private readonly llmClient: OpenRouterService) {}

  async execute(
    operation: DatabaseExecutionType,
    question: string,
    stocks: Stock[] = [],
  ): Promise<StockExecutionResult> {
    const operationTemplate = StockOperationTemplates[operation];

    if (operationTemplate.requiresStocks && stocks.length === 0) {
      return {
        operation,
        template: operationTemplate.template,
        summary: 'Nenhuma acao foi informada para executar a operacao no banco.',
        records: [],
        affected: 0,
      };
    }

    if (operation === 'insert') {
      const missingStockFields = validateRequiredStockInsertFields(stocks);

      if (Object.keys(missingStockFields).length > 0) {
        return {
          operation,
          template: operationTemplate.template,
          summary:
            'Existem informacoes obrigatorias faltando para gravar acoes no banco.',
          records: [],
          affected: 0,
          missingStockFields,
        };
      }
    }

    if (operation === 'update' || operation === 'delete') {
      const missingStockFields = validateSymbolFields(stocks);

      if (Object.keys(missingStockFields).length > 0) {
        return {
          operation,
          template: operationTemplate.template,
          summary:
            'O ticker da acao e obrigatorio para atualizar ou remover registros no banco.',
          records: [],
          affected: 0,
          missingStockFields,
        };
      }
    }

    const normalizedStocks = normalizeStocks(stocks);
    const dataSource = await initializeDataSource();
    const repository = new StockRepository(dataSource);

    switch (operation) {
      case 'insert':
        return this.insert(repository, normalizedStocks);
      case 'update':
        return this.update(repository, normalizedStocks);
      case 'delete':
        return this.delete(repository, normalizedStocks);
      case 'select':
      default:
        return this.select(repository, question, stocks);
    }
  }

  private async select(
    repository: StockRepository,
    question: string,
    stocks: Stock[],
  ): Promise<StockExecutionResult> {
    const { data, error } = await this.llmClient.generateStructured(
      getSelectQuerySystemPrompt(),
      getSelectQueryUserPromptTemplate({
        question,
        stocks,
      }),
      StockSelectQuerySchema,
    );

    if (error || !data?.query) {
      throw new Error(`Nao foi possivel gerar uma query SELECT segura: ${error ?? 'resposta vazia'}`);
    }

    const query = ensureSafeStockSelectQuery(data.query);
    const rows = await repository.executeSelectQuery(query);

    return {
      operation: 'select',
      template: StockOperationTemplates.select.template,
      summary: `Consulta SELECT executada com seguranca. Registros encontrados: ${rows.length}.`,
      query,
      rows,
      affected: rows.length,
    };
  }

  private async insert(
    repository: StockRepository,
    stocks: StockInput[],
  ): Promise<StockExecutionResult> {
    const result = await repository.upsertMany(stocks);
    const records = [...result.inserted, ...result.updated];
    const insertedSymbols = result.inserted.map((record) => record.symbol);
    const updatedSymbols = result.updated.map((record) => record.symbol);

    return {
      operation: 'insert',
      template: StockOperationTemplates.insert.template,
      summary:
        updatedSymbols.length > 0
          ? `Acao(oes) ja existente(s) atualizada(s): ${updatedSymbols.join(', ')}. Nova(s) acao(oes) cadastrada(s): ${insertedSymbols.join(', ') || 'nenhuma'}.`
          : `Cadastro realizado para ${records.length} acao(oes): ${records.map((record) => record.symbol).join(', ')}.`,
      records,
      affected: records.length,
      insertedSymbols,
      updatedSymbols,
    };
  }

  private async update(
    repository: StockRepository,
    stocks: StockInput[],
  ): Promise<StockExecutionResult> {
    const result = await repository.updateMany(stocks);

    return {
      operation: 'update',
      template: StockOperationTemplates.update.template,
      summary: `Atualizacao realizada para ${result.updated.length} acao(oes).`,
      records: result.updated,
      affected: result.updated.length,
      missingSymbols: result.missingSymbols,
    };
  }

  private async delete(
    repository: StockRepository,
    stocks: StockInput[],
  ): Promise<StockExecutionResult> {
    const symbols = stocks.map((stock) => stock.symbol);
    const affected = await repository.deleteBySymbols(symbols);

    return {
      operation: 'delete',
      template: StockOperationTemplates.delete.template,
      summary: `Remocao solicitada para ${symbols.join(', ')}. Registros removidos: ${affected}.`,
      affected,
    };
  }
}
