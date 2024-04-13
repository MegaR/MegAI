import { Bot, Player } from "mineflayer";
import BotMode from "./mode.interface";
import { Movements, goals } from "mineflayer-pathfinder";

export default function followMode(player: Player): BotMode {
    let bot: Bot;
    return {
        name: "🦵 Follow",
        start: async (currentBot: Bot) => {
            bot = currentBot;
            const movement = new Movements(bot);
            movement.canOpenDoors = true;
            movement.canDig = false;
            movement.allowParkour = true;
            movement.allowFreeMotion = true;

            bot.pathfinder.setMovements(movement);
            bot.pathfinder.setGoal(
                new goals.GoalFollow(player.entity, 5),
                true,
            );
        },
        stop: async () => {
            bot.pathfinder.stop();
        },
    };
}
