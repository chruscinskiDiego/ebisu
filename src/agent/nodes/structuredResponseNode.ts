import { AIMessage } from "@langchain/core/messages"
import { GraphState } from "../schemas/message.schema"

export const createStructuredResponseNode = (/*llmClient: OpenRouterService*/) => {

    return async (state: GraphState): Promise<Partial<GraphState>> => {

        try {

            /*const systemPrompt = getSystemPrompt()
            const userPrompt = getUserPromptTemplate(state.question!)
            const { data, error } = await llmClient.generateStructured(
              systemPrompt,
              userPrompt,
              QueryAnalysisSchema,
            )
      
            if(error) {
              console.log('⚠️  Failed to analyze query, assuming simple');
              return {
                ...state,
                error,
                isMultiStep: false,
              }
            }
      
            if (data?.requiresDecomposition && !!data.subQuestions?.length) {
                const subQuestionsFormatted = data.subQuestions
                    .map((q: string, i: number) => `\n   ${i + 1}. ${q}`)
                    .join('');

                console.log(`📊 Complex query - ${data.subQuestions.length} steps:${subQuestionsFormatted}`);


            return {
                isMultiStep: true,
                subQuestions: data.subQuestions,
                currentStep: 0,
                subQueries: [],
                subResults: []
            }
        }*/

            if (state.error) {
                return {
                    messages: [
                        new AIMessage(`Nao consegui processar sua mensagem: ${state.error}`),
                    ],
                };
            }

            return {
                messages: [
                    new AIMessage(`Recebi sua pergunta: ${state.question}`),
                ],
            };
        } catch (error: any) {
            console.error('❌ Error analyzing query:', error.message);
            return {
                messages: [
                    new AIMessage(`Nao consegui gerar uma resposta: ${error.message}`),
                ],
            };
        }
    }
}
