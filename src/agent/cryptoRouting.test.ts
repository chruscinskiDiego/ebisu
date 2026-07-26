import type { GraphState } from "./schemas/message.schema.ts";
import { IdentifyIntentionSchema } from "../prompts/v1/identifyIntention.ts";
import { getNextWorkflowNode } from "./taskRouting.ts";

describe("cryptocurrency workflow routing", () => {
  it("accepts cryptocurrency persistence output from the intention prompt", () => {
    const result = IdentifyIntentionSchema.parse({
      intention: "cryptoDatabaseExecution",
      route: "cryptoDatabaseExecution",
      workflowTasks: [
        {
          intention: "cryptoDatabaseExecution",
          route: "cryptoDatabaseExecution",
          databaseExecutionType: "insert",
        },
      ],
      databaseExecutionType: "insert",
      stocks: [],
      cryptos: [
        {
          symbol: "BTC",
          name: "Bitcoin",
          investmentAmount: 250,
          currency: "USDT",
        },
      ],
      userProfileUpdate: {},
      reasoning: "O usuario quer cadastrar Bitcoin.",
    });

    expect(result.cryptos[0]?.symbol).toBe("BTC");
  });

  it("runs stock and cryptocurrency tasks without losing their order", () => {
    const state = {
      workflowTasks: [
        {
          intention: "stockDatabaseExecution",
          route: "stockDatabaseExecution",
          databaseExecutionType: "select",
        },
        {
          intention: "cryptoDatabaseExecution",
          route: "cryptoDatabaseExecution",
          databaseExecutionType: "select",
        },
      ],
      completedWorkflowTasks: ["stockDatabaseExecution"],
    } as GraphState;

    expect(getNextWorkflowNode(state)).toBe("cryptoDatabaseExecution");
  });

  it("accepts one real-time task for stock and crypto subtasks", () => {
    const result = IdentifyIntentionSchema.parse({
      intention: "realTimeMarketShare",
      route: "getRealTimeMarketShare",
      workflowTasks: [
        {
          intention: "realTimeMarketShare",
          route: "getRealTimeMarketShare",
          databaseExecutionType: "select",
          assetTypes: ["stock", "crypto"],
        },
      ],
      databaseExecutionType: "select",
      stocks: [],
      cryptos: [],
      userProfileUpdate: {},
      reasoning: "O usuario pediu cotacoes das duas classes de ativos.",
    });

    expect(result.workflowTasks[0]?.assetTypes).toEqual(["stock", "crypto"]);
  });
});
