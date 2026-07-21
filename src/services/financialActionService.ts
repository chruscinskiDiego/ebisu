import { DatabaseExecutionType, FinancialAction } from '../agent/schemas/message.schema.ts';
import { initializeDataSource } from '../database/dataSource.ts';
import { FinancialActionEntity } from '../database/entities/financialAction.entity.ts';
import {
  FinancialActionInput,
  FinancialActionRepository,
} from '../database/repositories/financialActionRepository.ts';
import {
  FinancialActionSelectQuerySchema,
  getSystemPrompt as getSelectQuerySystemPrompt,
  getUserPromptTemplate as getSelectQueryUserPromptTemplate,
} from '../prompts/v1/financialActionSelectQuery.ts';
import { OpenRouterService } from './openrouterService.ts';

export type FinancialActionExecutionResult = {
  operation: DatabaseExecutionType;
  template: string;
  summary: string;
  records?: FinancialActionEntity[];
  rows?: Record<string, unknown>[];
  query?: string;
  affected?: number;
  missingNames?: string[];
};

export const FinancialActionOperationTemplates: Record<
  DatabaseExecutionType,
  {
    template: string;
    requiresFinancialActions: boolean;
  }
> = {
  select: {
    template: 'financial_action_select',
    requiresFinancialActions: false,
  },
  insert: {
    template: 'financial_action_insert',
    requiresFinancialActions: true,
  },
  update: {
    template: 'financial_action_update',
    requiresFinancialActions: true,
  },
  delete: {
    template: 'financial_action_delete',
    requiresFinancialActions: true,
  },
};

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

const normalizeFinancialActions = (
  financialActions: FinancialAction[] = [],
): FinancialActionInput[] => {
  return financialActions
    .map((action) => ({
      name: action.name.trim(),
      marketShare: action.marketShare,
    }))
    .filter((action) => action.name.length > 0);
};

const ensureSafeFinancialActionSelectQuery = (query: string): string => {
  const trimmedQuery = query.trim().replace(/;+\s*$/, '');
  const normalizedQuery = trimmedQuery.toLowerCase();

  if (!normalizedQuery.startsWith('select ')) {
    throw new Error('Apenas queries SELECT sao permitidas.');
  }

  if (/[;]/.test(trimmedQuery) || /--|\/\*/.test(trimmedQuery)) {
    throw new Error('A query SELECT nao pode conter multiplos comandos ou comentarios.');
  }

  if (!/\bfrom\s+financial_actions\b/i.test(trimmedQuery)) {
    throw new Error('A query SELECT deve usar somente a tabela financial_actions.');
  }

  if (/\bfrom\s+(?!financial_actions\b)[a-zA-Z_][\w.]*/i.test(trimmedQuery)) {
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

export class FinancialActionService {
  constructor(private readonly llmClient: OpenRouterService) {}

  async execute(
    operation: DatabaseExecutionType,
    question: string,
    financialActions: FinancialAction[] = [],
  ): Promise<FinancialActionExecutionResult> {
    const actions = normalizeFinancialActions(financialActions);
    const operationTemplate = FinancialActionOperationTemplates[operation];

    if (operationTemplate.requiresFinancialActions && actions.length === 0) {
      return {
        operation,
        template: operationTemplate.template,
        summary: 'Nenhuma acao financeira foi informada para executar a operacao no banco.',
        records: [],
        affected: 0,
      };
    }

    const dataSource = await initializeDataSource();
    const repository = new FinancialActionRepository(dataSource);

    switch (operation) {
      case 'insert':
        return this.insert(repository, actions);
      case 'update':
        return this.update(repository, actions);
      case 'delete':
        return this.delete(repository, actions);
      case 'select':
      default:
        return this.select(repository, question, financialActions);
    }
  }

  private async select(
    repository: FinancialActionRepository,
    question: string,
    financialActions: FinancialAction[],
  ): Promise<FinancialActionExecutionResult> {
    const { data, error } = await this.llmClient.generateStructured(
      getSelectQuerySystemPrompt(),
      getSelectQueryUserPromptTemplate({
        question,
        financialActions,
      }),
      FinancialActionSelectQuerySchema,
    );

    if (error || !data?.query) {
      throw new Error(`Nao foi possivel gerar uma query SELECT segura: ${error ?? 'resposta vazia'}`);
    }

    // validação da query SELECT gerada pela LLM
    const query = ensureSafeFinancialActionSelectQuery(data.query);
    
    const rows = await repository.executeSelectQuery(query);

    return {
      operation: 'select',
      template: FinancialActionOperationTemplates.select.template,
      summary: `Consulta SELECT executada com seguranca. Registros encontrados: ${rows.length}.`,
      query,
      rows,
      affected: rows.length,
    };
  }

  private async insert(
    repository: FinancialActionRepository,
    actions: FinancialActionInput[],
  ): Promise<FinancialActionExecutionResult> {
    const records = await repository.insertMany(actions);

    return {
      operation: 'insert',
      template: FinancialActionOperationTemplates.insert.template,
      summary: `Cadastro realizado para ${records.length} acao(oes) financeira(s): ${records.map((record) => record.name).join(', ')}.`,
      records,
      affected: records.length,
    };
  }

  private async update(
    repository: FinancialActionRepository,
    actions: FinancialActionInput[],
  ): Promise<FinancialActionExecutionResult> {
    const result = await repository.updateMany(actions);

    return {
      operation: 'update',
      template: FinancialActionOperationTemplates.update.template,
      summary: `Atualizacao realizada para ${result.updated.length} acao(oes) financeira(s).`,
      records: result.updated,
      affected: result.updated.length,
      missingNames: result.missingNames,
    };
  }

  private async delete(
    repository: FinancialActionRepository,
    actions: FinancialActionInput[],
  ): Promise<FinancialActionExecutionResult> {
    const names = actions.map((action) => action.name);
    const affected = await repository.deleteByNames(names);

    return {
      operation: 'delete',
      template: FinancialActionOperationTemplates.delete.template,
      summary: `Remocao solicitada para ${names.join(', ')}. Registros removidos: ${affected}.`,
      affected,
    };
  }
}
