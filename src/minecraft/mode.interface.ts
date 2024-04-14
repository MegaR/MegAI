export default interface BotMode {
    name: string;
    start: () => Promise<void>;
    stop: () => Promise<void>;
}
