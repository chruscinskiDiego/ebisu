import { END, START, StateGraph } from "@langchain/langgraph";
import { EbisuStateSchema } from "./schemas/message.schema.js";
import type { GraphState } from "./schemas/message.schema.js";
import { createIdentifyIntentionNode } from "./nodes/identifyIntentionNode.js";
import { createDatabaseExecutionNode } from "./nodes/databaseExecutionNode.js";
import { createGetRealTimeMarketShareNode } from "./nodes/getRealTimeMarketShareNode.js";
import { createStructuredResponseNode } from "./nodes/structuredResponseNode.js";
import { OpenRouterService } from "../services/openrouterService.js";

const routeAfterIdentifyIntention = (state: GraphState) => {
  if (state.error) return 'structuredResponse';

  switch (state.intention) {
    case 'databaseExecution':
      return 'databaseExecution';
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
    .addNode('databaseExecution', createDatabaseExecutionNode())
    .addNode('getRealTimeMarketShare', createGetRealTimeMarketShareNode())
    .addNode('structuredResponse', createStructuredResponseNode(llm))

    .addEdge(START, 'identifyIntention')
    .addConditionalEdges('identifyIntention', routeAfterIdentifyIntention)

    .addEdge('databaseExecution', 'structuredResponse')
    .addEdge('getRealTimeMarketShare', 'structuredResponse')
    .addEdge('structuredResponse', END);

  return workflow.compile();

}

export const graph = buildEbisuGraph(new OpenRouterService());
