import { z } from 'zod/v3';

export const FinalResponseSchema = z.object({
  message: z
    .string()
    .describe('Final user-facing response explaining clearly what was done or searched'),
});

export type FinalResponseData = z.infer<typeof FinalResponseSchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'Final Workflow Response Writer - Explain the completed workflow result clearly',
    output: 'Return JSON with: message',
    rules: [
      'Write the final response in the SAME language as the user question',
      'Be direct, clear, and useful; explain what was done or searched',
      'Start with the outcome of the workflow, not with generic introductions',
      'Mention the selected flow only when it helps clarify what happened',
      'When databaseExecutionResult exists, explain the database operation performed or prepared',
      'When realTimeMarketShareResult exists, explain what market share information was requested or searched',
      'When financialActions exists, include the extracted names and numeric values when available',
      'When there is an error, explain the issue and provide a practical next step',
      'When the intention is unknown, explain that no supported flow was confidently identified and suggest a clearer request',
      'Do not invent data that is not present in the workflow context',
      'Do not include raw JSON unless it is the clearest way to show extracted structured data',
    ],
    examples: [
      {
        question: 'Adicione a acao TTWO por US$200',
        workflow: {
          intention: 'databaseExecution',
          databaseExecutionType: 'insert',
          financialActions: [{ name: 'TTWO', marketShare: 200 }],
          result: 'Fluxo de banco selecionado (insert) para: Adicione a acao TTWO por US$200',
        },
        message:
          'Preparei a operacao de cadastro no banco para a acao **TTWO** com valor **200**. O fluxo identificado foi de banco de dados, com operacao **insert**.',
      },
      {
        question: 'Compare o market share atual da Apple e da Microsoft',
        workflow: {
          intention: 'realTimeMarketShare',
          financialActions: [
            { name: 'Apple', marketShare: null },
            { name: 'Microsoft', marketShare: null },
          ],
          result: 'Fluxo de market share em tempo real selecionado.',
        },
        message:
          'Busquei direcionar a pergunta para o fluxo de market share em tempo real. As entidades identificadas foram **Apple** e **Microsoft**; nenhum percentual foi informado na pergunta.',
      },
    ],
  });
};

export const getUserPromptTemplate = (input: {
  question?: string;
  error?: string;
  intention?: string;
  intentionReason?: string;
  databaseExecutionType?: string;
  financialActions?: Array<{
    name: string;
    marketShare: number | null;
  }>;
  databaseExecutionResult?: string;
  realTimeMarketShareResult?: string;
}): string => {
  return JSON.stringify(input);
};
