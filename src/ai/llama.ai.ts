import { ChatCompletionRequestMessage } from 'openai';
import * as path from 'path';
import { AiInterface, AiOptions } from './aiservice.interface';
import * as fs from 'fs';

export default class Llama implements AiInterface {
  llama: any;
  constructor() {
    this.load();
  }

  async load() {
    const llamaModule = await import('llama-node');
    // const llamaRSModule = await import('llama-node/dist/llm/llama-rs.js');
    const llamaCPPModule = await import('llama-node/dist/llm/llama-cpp.js');
    const model = path.resolve(process.cwd(), './models/ggml-model-q4_1.bin');
    if (!fs.existsSync(model)) {
      throw new Error(`Model file not found: ${model}`);
    }
    const llama = new llamaModule.LLama(llamaCPPModule.LLamaCpp);
    const config: any = {
      path: model,
      enableLogging: true,
      nCtx: 1024,
      nParts: -1,
      seed: 0,
      f16Kv: false,
      logitsAll: false,
      vocabOnly: false,
      useMlock: false,
      embedding: false,
    };
    llama.load(config);
    this.llama = llama;
  }

  async complete(
    messages: ChatCompletionRequestMessage[],
    options?: AiOptions,
  ): Promise<string> {
    const prompt = this.toPrompt(messages);

    let result = '';
    await this.llama.createCompletion(
      {
        nThreads: 4,
        nTokPredict: options?.maxTokens ?? 256,
        topK: 40,
        topP: 0.1,
        temp: 0.7,
        repeatPenalty: 1,
        stopSequence: '### Human',
        prompt: prompt,
      },
      (response) => {
        result += response.token;
      },
    );
    return this.cleanResult(result);
  }

  toPrompt(messages: ChatCompletionRequestMessage[]) {
    let prompt = '';
    for (const message of messages) {
      const author = message.name ?? message.role;
      prompt += `### ${author}:\n${message.content}\n`;
    }
    prompt += '### Assistant:';
    return prompt;
  }

  cleanResult(result: string): string {
    return result.replace('<end>', '').trimEnd();
  }
}
