import { END, START, StateGraph } from "@langchain/langgraph";
import { EbisuStateSchema } from "./schemas/message.schema.js";
import type { GraphState } from "./schemas/message.schema.js";
import { createIdentifyIntentionNode } from "./nodes/identifyIntentionNode.js";
import { createStockDatabaseExecutionNode } from "./nodes/stockDatabaseExecutionNode.js";
import { createGetRealTimeMarketShareNode } from "./nodes/getRealTimeMarketShareNode.js";
import { createStructuredResponseNode } from "./nodes/structuredResponseNode.js";
import { OpenRouterService } from "../services/openrouterService.js";
import { createUserMemoryNode } from "./nodes/userMemoryNode.js";

const routeAfterUserMemory = (state: GraphState) => {
  if (state.error) return 'structuredResponse';
  if (state.missingUserFields?.length) return 'structuredResponse';

  switch (state.intention) {
    case 'stockDatabaseExecution':
      return 'stockDatabaseExecution';
    case 'userDatabaseExecution':
      return 'structuredResponse';
    case 'realTimeMarketShare':
      return 'getRealTimeMarketShare';
    default:
      return 'structuredResponse';
  }
};

export const buildEbisuGraph = (llm: OpenRouterService) => {

  const workflow = new StateGraph({
    stateSchema: EbisuStateSchema,
  })
    .addNode('identifyIntention', createIdentifyIntentionNode(llm))
    .addNode('userMemory', createUserMemoryNode())
    .addNode('stockDatabaseExecution', createStockDatabaseExecutionNode(llm))
    .addNode('getRealTimeMarketShare', createGetRealTimeMarketShareNode())
    .addNode('structuredResponse', createStructuredResponseNode(llm))

    .addEdge(START, 'identifyIntention')
    .addEdge('identifyIntention', 'userMemory')
    .addConditionalEdges('userMemory', routeAfterUserMemory)

    .addEdge('stockDatabaseExecution', 'structuredResponse')

    .addEdge('getRealTimeMarketShare', 'structuredResponse')
    .addEdge('structuredResponse', END);

  return workflow.compile();

}

export const graph = buildEbisuGraph(new OpenRouterService());
