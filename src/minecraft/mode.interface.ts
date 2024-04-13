import { Bot } from "mineflayer";

export default interface BotMode {
    name: string;
    start: (bot: Bot) => Promise<void>;
    stop: () => Promise<void>;
}
