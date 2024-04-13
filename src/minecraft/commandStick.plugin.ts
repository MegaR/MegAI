import { Bot } from "mineflayer";
import vec3 from "vec3";
import { Block } from "prismarine-block";

declare module "mineflayer" {
    interface BotEvents {
        stickCommand: (block: Block | undefined, entity: Player) => void;
    }
}

export default function commandStickPlugin(bot: Bot) {
    bot.on("entitySwingArm", (entity) => {
        console.log(entity.heldItem?.name);
        if (entity.heldItem?.name !== "stick") {
            return;
        }
        const eyePosition = entity.position.offset(0, 1.6, 0);
        const z = -(Math.cos(entity.yaw) * Math.cos(entity.pitch));
        const y = Math.sin(entity.pitch);
        const x = -(Math.sin(entity.yaw) * Math.cos(entity.pitch));
        const viewDirection = vec3(x, y, z);
        const block = bot!.world.raycast(eyePosition, viewDirection, 5) as
            | Block
            | undefined;
        bot.emit("stickCommand", block, bot.players[entity.username!]);
    });
}
