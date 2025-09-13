import OpenAIService from "#services/openai_service";
import { test } from "@japa/runner";
import sinon from "sinon";
import OpenAI from "openai";

test.group("OpenAI Service", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.setup(() => {
    sandbox = sinon.createSandbox();
  });

  group.each.teardown(() => {
    sandbox.restore();
    sandbox = sinon.createSandbox();
  });

  group.teardown(() => {
    sandbox.restore();
  });

  test("should create service with API key only", ({ assert }) => {
    const service = new OpenAIService("test-api-key");
    assert.instanceOf(service, OpenAIService);
  });

  test("should create service with API key and base URL", ({ assert }) => {
    const service = new OpenAIService("test-api-key", "https://api.custom.com");
    assert.instanceOf(service, OpenAIService);
  });

  test("should create service with API key, base URL, and custom model", ({
    assert,
  }) => {
    const service = new OpenAIService(
      "test-api-key",
      "https://api.custom.com",
      "gpt-4",
    );
    assert.instanceOf(service, OpenAIService);
  });

  test("should call createChatCompletion with default parameters", async ({
    assert,
  }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-test123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-3.5-turbo-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hello! How can I help you today?",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 11, completion_tokens: 9, total_tokens: 20 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    const result = await service.createChatCompletion(messages);

    assert.isTrue(createStub.calledOnce);
    assert.deepEqual(createStub.firstCall.args[0], {
      model: "gpt-3.5-turbo",
      messages,
      temperature: undefined,
      max_tokens: undefined,
    });
    assert.equal(
      result.choices[0].message.content,
      "Hello! How can I help you today?",
    );
    assert.equal(result.id, "chatcmpl-test123");
  });

  test("should call createChatCompletion with custom options", async ({
    assert,
  }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-custom456",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "This is a custom response with GPT-4.",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 12, total_tokens: 27 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Tell me about AI" },
    ];

    const options = {
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 150,
    };

    const result = await service.createChatCompletion(messages, options);

    assert.isTrue(createStub.calledOnce);
    assert.deepEqual(createStub.firstCall.args[0], {
      model: "gpt-4",
      messages,
      temperature: 0.7,
      max_tokens: 150,
    });
    assert.equal(
      result.choices[0].message.content,
      "This is a custom response with GPT-4.",
    );
    assert.equal(result.model, "gpt-4-0613");
  });

  test("should handle multiple messages correctly", async ({ assert }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-multi789",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-3.5-turbo-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "I understand the conversation context.",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 45, completion_tokens: 8, total_tokens: 53 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi! How can I help?" },
      { role: "user", content: "What is the weather like?" },
    ];

    const result = await service.createChatCompletion(messages);

    assert.isTrue(createStub.calledOnce);
    assert.equal(createStub.firstCall.args[0].messages.length, 4);
    assert.deepEqual(createStub.firstCall.args[0].messages, messages);
    assert.equal(result.usage?.total_tokens, 53);
  });

  test("should handle OpenAI API errors", async ({ assert }) => {
    const apiError = new Error(
      "Request failed with status code 401: Incorrect API key provided",
    );
    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .rejects(apiError);

    const service = new OpenAIService("invalid-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    await assert.rejects(async () => {
      await service.createChatCompletion(messages);
    }, "Request failed with status code 401: Incorrect API key provided");

    assert.isTrue(createStub.calledOnce);
  });

  test("should handle rate limit errors", async ({ assert }) => {
    const rateLimitError = new Error(
      "Request failed with status code 429: Rate limit exceeded",
    );
    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .rejects(rateLimitError);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    await assert.rejects(async () => {
      await service.createChatCompletion(messages);
    }, "Request failed with status code 429: Rate limit exceeded");

    assert.isTrue(createStub.calledOnce);
  });

  test("should handle network errors", async ({ assert }) => {
    const networkError = new Error("Network Error: Connection timeout");
    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .rejects(networkError);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    await assert.rejects(async () => {
      await service.createChatCompletion(messages);
    }, "Network Error: Connection timeout");

    assert.isTrue(createStub.calledOnce);
  });

  test("should pass temperature as 0 when explicitly set", async ({
    assert,
  }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-temp000",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-3.5-turbo-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Deterministic response.",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Give me a deterministic answer" },
    ];

    await service.createChatCompletion(messages, { temperature: 0 });

    assert.isTrue(createStub.calledOnce);
    assert.equal(createStub.firstCall.args[0].temperature, 0);
  });

  test("should pass maxTokens as 1 when explicitly set", async ({ assert }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-token001",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-3.5-turbo-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hi",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "length",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Say hi" },
    ];

    await service.createChatCompletion(messages, { maxTokens: 1 });

    assert.isTrue(createStub.calledOnce);
    assert.equal(createStub.firstCall.args[0].temperature, undefined);
  });

  test("should use custom default model when provided", async ({ assert }) => {
    const mockResponse: OpenAI.Chat.Completions.ChatCompletion = {
      id: "chatcmpl-custom123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4-0613",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Response from custom model.",
            refusal: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    const createStub = sandbox
      .stub(OpenAI.Chat.Completions.prototype, "create")
      .resolves(mockResponse);

    const service = new OpenAIService("test-api-key", undefined, "gpt-4");
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
    ];

    await service.createChatCompletion(messages);

    assert.isTrue(createStub.calledOnce);
    assert.equal(createStub.firstCall.args[0].model, "gpt-4");
  });
});
