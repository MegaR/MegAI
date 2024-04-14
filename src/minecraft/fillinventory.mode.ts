import { Bot } from "mineflayer";
import BotMode from "./mode.interface";
import { Block } from "prismarine-block";
import idleMode from "./idle.mode";
import { getLogger } from "../logger";
import { Movements, goals } from "mineflayer-pathfinder";

const logger = getLogger("fillInventoryMode");
export default function fillInventoryMode(bot: Bot, block: Block): BotMode {
    return {
        name: "Fill inventory",
        start: async () => {
            const movement = new Movements(bot);
            movement.canOpenDoors = true;
            movement.canDig = false;
            movement.allowParkour = true;
            movement.allowFreeMotion = true;
            bot.pathfinder.setMovements(movement);
            await bot.pathfinder.goto(
                new goals.GoalNear(
                    block.position.x,
                    block.position.y,
                    block.position.z,
                    4
                )
            );

            const chest = await bot.openContainer(block);
            try {
                for (const item of chest.containerItems()) {
                    if (chest.firstEmptyInventorySlot() === null) {
                        logger.warn("Inventory is full");
                        break;
                    }
                    await chest.withdraw(item.type, null, item.count);
                }
            } finally {
                chest.close();
            }
            bot.armorManager.equipAll();
            bot.setMode(idleMode);
        },
        stop: async () => {},
    };
}
