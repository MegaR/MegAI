import { Bot } from "mineflayer";
import BotMode from "./mode.interface";
import idleMode from "./idle.mode";

declare module "mineflayer" {
    interface Bot {
        mode: BotMode;
        setMode: (mode: BotMode) => Promise<void>;
    }
    interface BotEvents {
        modeChanged: () => void;
    }
}

export default function modePlugin(bot: Bot) {
    bot.mode = idleMode;

    bot.setMode = async (newMode: BotMode) => {
        if (!bot) {
            throw new Error("Bot not set yet");
        }
        await bot.mode.stop();
        bot.mode = newMode;
        await bot.mode.start(bot);
    }
}
