/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import { EbisuStateSchema } from "./schemas/message.schema.js";
import { createIdentifyIntentionNode } from "./nodes/identifyIntentionNode.js";
import { createStructuredResponseNode } from "./nodes/structuredResponseNode.js";

export const buildEbisuGraph = () => {

  const workflow = new StateGraph({
    stateSchema: EbisuStateSchema,
  })
    .addNode('identifyIntention', createIdentifyIntentionNode())
    .addNode('structuredResponse', createStructuredResponseNode())
    
    .addEdge(START, 'identifyIntention')
    .addEdge('identifyIntention', 'structuredResponse')

    .addEdge('structuredResponse', END);

    /*.addConditionalEdges('extractQuestion', (state: GraphState) => {
      if (state.error) return END;
      return 'queryPlanner';
    })

    .addEdge('queryPlanner', 'cypherGenerator')
    .addEdge('cypherGenerator', 'cypherExecutor')

    .addConditionalEdges('cypherExecutor', (state: GraphState) => {
      if (state.needsCorrection && (!state.correctionAttempts || state.correctionAttempts < 1)) {
        return 'cypherCorrection';
      }

      if (state.isMultiStep && state.subQuestions && state.currentStep !== undefined) {
        if (state.currentStep < state.subQuestions.length) {
          return 'cypherGenerator';
        }
      }

      return 'analyticalResponse';
    })

    .addEdge('cypherCorrection', 'cypherExecutor')
    .addEdge('analyticalResponse', END);*/


  return workflow.compile();
}

export const graph = buildEbisuGraph();
