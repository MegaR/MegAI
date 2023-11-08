import { ChatCompletionMessageParam } from "openai/resources";

export default class HistoryManager {
    messages: ChatCompletionMessageParam[] = [];
    addMessage(message: ChatCompletionMessageParam) {
        this.messages.push(message);
        this.messages = this.messages.slice(-10);
    }
    getHistory() {
        return this.messages;
    }
}
