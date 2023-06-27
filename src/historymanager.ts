import { ChatCompletionRequestMessage } from "openai";

export default class HistoryManager {
    messages: ChatCompletionRequestMessage[] = [];
    addMessage(message: ChatCompletionRequestMessage) {
        this.messages.push(message);
        this.messages = this.messages.slice(-10);
    }
    getHistory() {
        return this.messages;
    }
}