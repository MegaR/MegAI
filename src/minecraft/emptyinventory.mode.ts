import { Bot } from "mineflayer";
import BotMode from "./mode.interface";
import { Block } from "prismarine-block";
import idleMode from "./idle.mode";
import { getLogger } from "../logger";
import { Movements, goals } from "mineflayer-pathfinder";

const logger = getLogger("emptyInventoryMode");
export default function emptyInventoryMode(bot: Bot, block: Block): BotMode {
    return {
        name: "Empty inventory",
        start: async () => {
            const movement = new Movements(bot);
            movement.canOpenDoors = true;
            movement.canDig = false;
            movement.allowParkour = true;
            movement.allowFreeMotion = true;
            bot.pathfinder.setMovements(movement);
            await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 4));

            if(bot.inventory.emptySlotCount() >= 5) {
                const equipment = bot.entity.equipment;
                if(equipment[1]) {
                    await bot.unequip("off-hand");
                }
                if(equipment[2]) {
                    await bot.unequip("feet");
                }
                if(equipment[3]) {
                    await bot.unequip("legs");
                }
                if(equipment[4]) {
                    await bot.unequip("torso");
                }
                if(equipment[5]) {
                    await bot.unequip("head");
                }
            }
            const chest = await bot.openContainer(block);
            for(const item of bot.inventory.items()) {
                if(chest.firstEmptyContainerSlot() === null) {
                    logger.warn("Chest is full");
                    break;
                }
                await chest.deposit(item.type, null, item.count);
            }
            chest.close();
            bot.setMode(idleMode);
        },
        stop: async () => {

        },
    }

}
