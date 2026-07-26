import {
  DatabaseExecutionType,
  Crypto,
} from "../agent/schemas/message.schema.ts";
import { initializeDataSource } from "../database/dataSource.ts";
import { CryptoEntity } from "../database/entities/crypto.entity.ts";
import {
  CryptoInput,
  CryptoRepository,
} from "../database/repositories/cryptoRepository.ts";
import {
  CryptoSelectQuerySchema,
  getSystemPrompt as getSelectQuerySystemPrompt,
  getUserPromptTemplate as getSelectQueryUserPromptTemplate,
} from "../prompts/v1/cryptoSelectQuery.ts";
import { OpenRouterService } from "./openrouterService.ts";

export type CryptoExecutionResult = {
  operation: DatabaseExecutionType;
  template: string;
  summary: string;
  records?: CryptoEntity[];
  rows?: Record<string, unknown>[];
  query?: string;
  affected?: number;
  missingSymbols?: string[];
  missingCryptoFields?: Record<string, string[]>;
  insertedSymbols?: string[];
  updatedSymbols?: string[];
};

export const CryptoOperationTemplates: Record<
  DatabaseExecutionType,
  {
    template: string;
    requiresCryptos: boolean;
  }
> = {
  select: {
    template: "crypto_select",
    requiresCryptos: false,
  },
  insert: {
    template: "crypto_insert",
    requiresCryptos: true,
  },
  update: {
    template: "crypto_update",
    requiresCryptos: true,
  },
  delete: {
    template: "crypto_delete",
    requiresCryptos: true,
  },
};

const REQUIRED_CRYPTO_INSERT_FIELDS = ["symbol", "name"] as const;

const forbiddenSelectTokens = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "grant",
  "revoke",
  "merge",
  "call",
  "execute",
  "begin",
  "commit",
  "rollback",
  "join",
];

const cryptoLabel = (crypto: Crypto, index: number): string => {
  return crypto.symbol?.trim() || crypto.name?.trim() || `crypto_${index + 1}`;
};

const validateRequiredCryptoInsertFields = (
  cryptos: Crypto[] = [],
): Record<string, string[]> => {
  return cryptos.reduce<Record<string, string[]>>(
    (missingFieldsByCrypto, crypto, index) => {
      const missingFields = REQUIRED_CRYPTO_INSERT_FIELDS.filter((field) => {
        const value = crypto[field];
        return typeof value !== "string" || !value.trim();
      });

      if (missingFields.length > 0) {
        missingFieldsByCrypto[cryptoLabel(crypto, index)] = [...missingFields];
      }

      return missingFieldsByCrypto;
    },
    {},
  );
};

const validateSymbolFields = (
  cryptos: Crypto[] = [],
): Record<string, string[]> => {
  return cryptos.reduce<Record<string, string[]>>(
    (missingFieldsByCrypto, crypto, index) => {
      if (!crypto.symbol?.trim()) {
        missingFieldsByCrypto[cryptoLabel(crypto, index)] = ["symbol"];
      }

      return missingFieldsByCrypto;
    },
    {},
  );
};

const normalizeCryptos = (cryptos: Crypto[] = []): CryptoInput[] => {
  return cryptos.map((crypto) => ({
    symbol: crypto.symbol?.trim().toUpperCase() ?? "",
    name:
      crypto.name?.trim() || crypto.symbol?.trim().toUpperCase() || undefined,
    investmentAmount: crypto.investmentAmount ?? undefined,
    currency: "USDT",
  }));
};

const ensureSafeCryptoSelectQuery = (query: string): string => {
  const trimmedQuery = query.trim().replace(/;+\s*$/, "");

  if (!trimmedQuery.toLowerCase().startsWith("select ")) {
    throw new Error("Apenas queries SELECT sao permitidas.");
  }

  if (/[;]/.test(trimmedQuery) || /--|\/\*/.test(trimmedQuery)) {
    throw new Error(
      "A query SELECT nao pode conter multiplos comandos ou comentarios.",
    );
  }

  if (!/\bfrom\s+cryptos\b/i.test(trimmedQuery)) {
    throw new Error("A query SELECT deve usar somente a tabela cryptos.");
  }

  if (/\bfrom\s+(?!cryptos\b)[a-zA-Z_][\w.]*/i.test(trimmedQuery)) {
    throw new Error("A query SELECT referencia uma tabela nao permitida.");
  }

  const hasForbiddenToken = forbiddenSelectTokens.some((token) =>
    new RegExp(`\\b${token}\\b`, "i").test(trimmedQuery),
  );

  if (hasForbiddenToken) {
    throw new Error(
      "A query SELECT contem operacao ou clausula nao permitida.",
    );
  }

  if (!/\blimit\s+\d+\b/i.test(trimmedQuery)) {
    return `${trimmedQuery} LIMIT 100`;
  }

  return trimmedQuery;
};

export class CryptoService {
  constructor(private readonly llmClient: OpenRouterService) {}

  async execute(
    operation: DatabaseExecutionType,
    question: string,
    cryptos: Crypto[] = [],
  ): Promise<CryptoExecutionResult> {
    const operationTemplate = CryptoOperationTemplates[operation];

    if (operationTemplate.requiresCryptos && cryptos.length === 0) {
      return {
        operation,
        template: operationTemplate.template,
        summary:
          "Nenhuma criptomoeda foi informada para executar a operacao no banco.",
        records: [],
        affected: 0,
      };
    }

    if (operation === "insert") {
      const missingCryptoFields = validateRequiredCryptoInsertFields(cryptos);

      if (Object.keys(missingCryptoFields).length > 0) {
        return {
          operation,
          template: operationTemplate.template,
          summary:
            "Existem informacoes obrigatorias faltando para gravar criptomoedas no banco.",
          records: [],
          affected: 0,
          missingCryptoFields,
        };
      }
    }

    if (operation === "update" || operation === "delete") {
      const missingCryptoFields = validateSymbolFields(cryptos);

      if (Object.keys(missingCryptoFields).length > 0) {
        return {
          operation,
          template: operationTemplate.template,
          summary:
            "O simbolo da criptomoeda e obrigatorio para atualizar ou remover registros no banco.",
          records: [],
          affected: 0,
          missingCryptoFields,
        };
      }
    }

    const normalizedCryptos = normalizeCryptos(cryptos);
    const dataSource = await initializeDataSource();
    const repository = new CryptoRepository(dataSource);

    switch (operation) {
      case "insert":
        return this.insert(repository, normalizedCryptos);
      case "update":
        return this.update(repository, normalizedCryptos);
      case "delete":
        return this.delete(repository, normalizedCryptos);
      case "select":
      default:
        return this.select(repository, question, cryptos);
    }
  }

  private async select(
    repository: CryptoRepository,
    question: string,
    cryptos: Crypto[],
  ): Promise<CryptoExecutionResult> {
    const { data, error } = await this.llmClient.generateStructured(
      getSelectQuerySystemPrompt(),
      getSelectQueryUserPromptTemplate({
        question,
        cryptos,
      }),
      CryptoSelectQuerySchema,
    );

    if (error || !data?.query) {
      throw new Error(
        `Nao foi possivel gerar uma query SELECT segura: ${error ?? "resposta vazia"}`,
      );
    }

    const query = ensureSafeCryptoSelectQuery(data.query);
    const rows = await repository.executeSelectQuery(query);

    return {
      operation: "select",
      template: CryptoOperationTemplates.select.template,
      summary: `Consulta SELECT executada com seguranca. Registros encontrados: ${rows.length}.`,
      query,
      rows,
      affected: rows.length,
    };
  }

  private async insert(
    repository: CryptoRepository,
    cryptos: CryptoInput[],
  ): Promise<CryptoExecutionResult> {
    const result = await repository.upsertMany(cryptos);
    const records = [...result.inserted, ...result.updated];
    const insertedSymbols = result.inserted.map((record) => record.symbol);
    const updatedSymbols = result.updated.map((record) => record.symbol);

    return {
      operation: "insert",
      template: CryptoOperationTemplates.insert.template,
      summary:
        updatedSymbols.length > 0
          ? `Criptomoeda(s) ja existente(s) atualizada(s): ${updatedSymbols.join(", ")}. Nova(s) criptomoeda(s) cadastrada(s): ${insertedSymbols.join(", ") || "nenhuma"}.`
          : `Cadastro realizado para ${records.length} criptomoeda(s): ${records.map((record) => record.symbol).join(", ")}.`,
      records,
      affected: records.length,
      insertedSymbols,
      updatedSymbols,
    };
  }

  private async update(
    repository: CryptoRepository,
    cryptos: CryptoInput[],
  ): Promise<CryptoExecutionResult> {
    const result = await repository.updateMany(cryptos);

    return {
      operation: "update",
      template: CryptoOperationTemplates.update.template,
      summary: `Atualizacao realizada para ${result.updated.length} criptomoeda(s).`,
      records: result.updated,
      affected: result.updated.length,
      missingSymbols: result.missingSymbols,
    };
  }

  private async delete(
    repository: CryptoRepository,
    cryptos: CryptoInput[],
  ): Promise<CryptoExecutionResult> {
    const symbols = cryptos.map((crypto) => crypto.symbol);
    const affected = await repository.deleteBySymbols(symbols);

    return {
      operation: "delete",
      template: CryptoOperationTemplates.delete.template,
      summary: `Remocao solicitada para ${symbols.join(", ")}. Registros removidos: ${affected}.`,
      affected,
    };
  }
}
