import { getSystemPrompt, IdentifyIntentionSchema } from '../../prompts/v1/identifyIntention.ts';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { GraphState, Intention } from '../schemas/message.schema.ts';

const getMessageText = (content: unknown): string => {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          typeof item.text === 'string'
        ) {
          return item.text;
        }
        return '';
      })
      .join('');
  }

  return '';
};

export const createIdentifyIntentionNode = (llm: OpenRouterService) => {

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    
    try {

      if (!state.messages?.length) {
        console.error('No messages in state');
        return {
          error: 'Nenhuma mensagem enviada!',
        };
      }

      const lastUserMessage = [...state.messages]
        .reverse()
        .find((message) => message._getType() === 'human');

      const question = getMessageText(lastUserMessage?.content);

      if (!question.trim()) {
        console.error('Extracted question is empty');
        return {
          error: 'No valid question found in messages',
        };
      }

      const systemPrompt = getSystemPrompt();

      const { data, error } = await llm.generateStructured(
        systemPrompt,
        question,
        IdentifyIntentionSchema,
      )

      if(error) {
        console.log('⚠️  Failed to analyze query, assuming simple');
        return {
          ...state,
          error
        }
      }

      console.log(JSON.stringify(data, null, 2));

      return {
        question,
        intention: data?.intention,
        intentionReason: data?.reasoning,
        error: undefined,
        databaseExecutionType: data?.databaseExecutionType,
        financialActions: data?.financialActions,
      };

    } catch (error: any) {

      console.error('Error extracting question:', error.message);
      return {
        error: `Failed to extract question: ${error.message}`,
      };

    }
  };
}
