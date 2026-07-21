import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config.ts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { z } from 'zod/v3';

export type LLMResponse = {
  model: string;
  content: string;
};

export class OpenRouterService {
  private llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.models[0],
      temperature: config.temperature,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.httpReferer,
          'X-Title': config.xTitle,
        },
      },

      // Pass provider routing and models array to OpenRouter
      modelKwargs: {
        models: config.models,
        provider: config.provider,
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ) {
    try {
      const messages = [
        new SystemMessage(
          `${systemPrompt}\n\nReturn only valid JSON matching the requested schema. Do not include markdown, code fences, or explanatory text.`,
        ),
        new HumanMessage(userPrompt),
      ];

      const response = await this.llmClient.invoke(messages);
      const content = this.getTextContent(response.content);
      const parsedContent = this.parseJsonContent(content);
      const data = schema.parse(parsedContent);

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private getTextContent(content: unknown): string {
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
  }

  private parseJsonContent(content: string): unknown {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new Error('OpenRouter returned an empty response');
    }

    try {
      return JSON.parse(trimmedContent);
    } catch {
      const jsonMatch = trimmedContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error(`OpenRouter response is not valid JSON: ${trimmedContent}`);
      }

      return JSON.parse(jsonMatch[0]);
    }
  }
}
