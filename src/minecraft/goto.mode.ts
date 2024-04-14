import { Bot } from "mineflayer";
import BotMode from "./mode.interface";
import { Movements, goals } from "mineflayer-pathfinder";

export default function gotoMode(bot: Bot, x: number, y: number, z?: number): BotMode {
    return {
        name: "📌 goto",
        start: async () => {
            const movement = new Movements(bot);
            movement.canOpenDoors = true;
            movement.canDig = false;
            movement.allowParkour = true;
            movement.allowFreeMotion = true;
            bot.pathfinder.setMovements(movement);
            if (z) {
                bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
            } else {
                bot.pathfinder.setGoal(new goals.GoalXZ(x, y));
            }
        },
        stop: async () => {
            bot.pathfinder.stop();
        },
    };
}
