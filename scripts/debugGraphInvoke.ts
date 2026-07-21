import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { config as loadEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

loadEnv();

const { graph } = await import('../src/agent/graph.ts');

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

const getLastAssistantMessage = (messages: BaseMessage[]): BaseMessage | undefined => {
  return [...messages].reverse().find((message) => message._getType() === 'ai');
};

const rl = createInterface({ input, output });
const messages: BaseMessage[] = [];

console.log('Debug Graph Invoke iniciado.');
console.log('Coloque breakpoints nos nodes/services, digite uma mensagem e pressione Enter.');
console.log('Digite /exit para sair.\n');

while (true) {
  const userInput = (await rl.question('voce> ')).trim();

  if (!userInput) continue;
  if (userInput === '/exit') break;

  messages.push(new HumanMessage(userInput));

  try {
    const result = await graph.invoke({ messages });
    const resultMessages = result.messages ?? [];

    messages.splice(0, messages.length, ...resultMessages);

    const lastAssistantMessage = getLastAssistantMessage(messages);
    const assistantText = getMessageText(lastAssistantMessage?.content);

    console.log(`assistente> ${assistantText || '[sem resposta]'}\n`);
  } catch (error) {
    console.error('Erro ao invocar o grafo:', error);
  }
}

rl.close();
