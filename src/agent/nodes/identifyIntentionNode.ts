import { getSystemPrompt as getIntentionSystemPrompt, IdentifyIntentionSchema } from '../../prompts/v1/identifyIntention.ts';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { GraphState, WorkflowTask } from '../schemas/message.schema.ts';

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

const getRecentConversationText = (messages: GraphState['messages']): string => {
  return messages
    .slice(-8)
    .map((message) => {
      const role = message._getType() === 'human' ? 'usuario' : 'assistente';
      const text = getMessageText(message.content).trim();

      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
};

const getErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
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

      const systemPrompt = getIntentionSystemPrompt();
      const recentConversation = getRecentConversationText(state.messages);

      const { data, error } = await llm.generateStructured(
        systemPrompt,
        JSON.stringify({
          currentMessage: question,
          recentConversation,
        }),
        IdentifyIntentionSchema,
      )

      if (error) {
        console.log('⚠️  Failed to analyze query, assuming simple');
        return {
          ...state,
          error
        }
      }

      const workflowTasks: WorkflowTask[] = data?.workflowTasks?.length
        ? data.workflowTasks
        : data?.intention && data?.route
          ? [
              {
                intention: data.intention,
                route: data.route,
                databaseExecutionType: data.databaseExecutionType,
                description: data.reasoning,
              },
            ]
          : [];

      return {
        question,
        intention: data?.intention,
        intentionReason: data?.reasoning,
        workflowTasks,
        completedWorkflowTasks: [],
        workflowExecutionResults: [],
        error: undefined,
        databaseExecutionType: data?.databaseExecutionType,
        stocks: data?.stocks,
        cryptos: data?.cryptos,
        userProfileUpdate: data?.userProfileUpdate,
      };

    } catch (error: unknown) {

      const message = getErrorMessage(error);
      console.error('Error extracting question:', message);
      return {
        error: `Failed to extract question: ${message}`,
      };

    }
  };
}
