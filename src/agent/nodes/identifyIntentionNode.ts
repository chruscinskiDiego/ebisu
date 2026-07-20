import { GraphState } from '../schemas/message.schema.ts';

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

export const createIdentifyIntentionNode = () => {

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

      console.log(`📝 Extracted question: "${question}"`);

      return {
        question,
        error: undefined,
      };
    } catch (error: any) {

      console.error('Error extracting question:', error.message);
      return {
        error: `Failed to extract question: ${error.message}`,
      };

    }
  };
}
