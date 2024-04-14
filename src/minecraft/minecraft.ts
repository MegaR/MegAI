import {
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
    SlashCommandBuilder,
} from "discord.js";
import Command from "../commands/command.interface";
import mineflayer, { Player, Bot } from "mineflayer";
import { getLogger } from "../logger";
import { pathfinder } from "mineflayer-pathfinder";
import { Block } from "prismarine-block";
import armorManager from "mineflayer-armor-manager";
import autoeat from "mineflayer-auto-eat";
import mineflayerTool from "mineflayer-tool";
import { z } from "zod";
import idleMode from "./idle.mode";
import followMode from "./follow.mode";
import gotoMode from "./goto.mode";
import commandStickPlugin from "./commandStick.plugin";
import modePlugin from "./mode.plugin";
import emptyInventoryMode from "./emptyinventory.mode";
import fillInventoryMode from "./fillinventory.mode";

const logger = getLogger("minecraft");
let bot: Bot | undefined;
let statusMessage: Message | undefined;
let statusInterval: NodeJS.Timeout | undefined;

type MCCommand = {
    name: string;
    call: (
        interaction: ChatInputCommandInteraction,
        params: string | null
    ) => Promise<void>;
};
const commands: MCCommand[] = [
    { name: "connect", call: connect },
    { name: "disconnect", call: disconnect },
    { name: "status", call: status },
    { name: "follow", call: follow },
    { name: "goto", call: goto },
];

export const minecraftCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("mc")
        .setDescription("minecraft bot commands.")
        .addStringOption((option) =>
            option
                .setName("command")
                .setDescription("command")
                .setRequired(true)
                .addChoices(
                    ...commands.map((c) => ({ name: c.name, value: c.name }))
                )
        )
        .addStringOption((option) =>
            option.setName("params").setDescription("params").setRequired(false)
        ),
    handleCommand: async (
        _client: Client,
        interaction: ChatInputCommandInteraction
    ) => {
        const commandName = interaction.options.getString("command", true);
        const params = interaction.options.getString("params");

        for (const command of commands) {
            if (command.name !== commandName) {
                continue;
            }
            try {
                logger.info(`Executing command: ${commandName}`);
                await command.call(interaction, params);
            } catch (e) {
                logger.error(e);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: `❌ Command failed ${e}`,
                        ephemeral: true,
                    });
                }
            }
            return;
        }
        logger.error(`Unknown command: ${commandName}`);
        await interaction.reply({
            content: "❌ Unknown command",
            ephemeral: true,
        });
    },
};

async function connect(interaction: ChatInputCommandInteraction) {
    bot = mineflayer.createBot({
        host: z.string().parse(process.env.MINECRAFT_HOST),
        port: z.coerce.number().parse(process.env.MINECRAFT_PORT),
        version: process.env.MINECRAFT_VERSION,
        username: z.string().parse(process.env.MINECRAFT_USERNAME),
        auth: z
            .enum(["mojang", "microsoft", "offline"])
            .parse(process.env.MINECRAFT_AUTH),
        profilesFolder: z
            .string()
            .optional()
            .parse(process.env.MINECRAFT_PROFILEFOLDER),
    });
    bot.loadPlugins([
        pathfinder,
        armorManager,
        autoeat.plugin,
        mineflayerTool.plugin,
        commandStickPlugin,
        modePlugin,
    ]);

    bot.on("chat", (username, message) => {
        logger.info(`${username}: ${message}`);
    });
    await status(interaction);
    statusInterval = setInterval(() => updateStatus(), 10000);

    bot.once("spawn", () => {
        updateStatus();
        bot!.armorManager.equipAll();
    });

    bot.on("stickCommand", (block, player) => {
        handleStickCommand(block, player);
    });

    bot.on("modeChanged", () => {
        updateStatus();
    });
}

async function disconnect(interaction: ChatInputCommandInteraction) {
    if (!bot) {
        return;
    }
    await bot.mode.stop();
    bot.quit();
    bot = undefined;
    await updateStatus();
    statusMessage = undefined;
    await interaction.reply({ content: "⛔ Disconnected", ephemeral: true });
    await updateStatus();
}

async function handleStickCommand(block: Block | undefined, player: Player) {
    if (block) {
        if (block.name === "chest") {
            if (bot!.inventory.items().length > 0) {
                return bot!.setMode(emptyInventoryMode(bot!, block));
            } else {
                return bot!.setMode(fillInventoryMode(bot!, block));
            }
        }
        return bot!.setMode(
            gotoMode(
                bot!,
                block.position.x,
                block.position.y + 1,
                block.position.z
            )
        );
    }

    //toggle follow
    if (bot!.mode.name === "🦵 Follow") {
        bot!.setMode(idleMode);
    } else {
        bot!.setMode(followMode(bot!, player));
    }
}

async function status(interaction: ChatInputCommandInteraction) {
    if (interaction.replied) {
        statusMessage = await interaction.channel!.send({
            content: "Loading...",
        });
    } else {
        statusMessage = await interaction.reply({
            content: "Loading...",
            fetchReply: true,
        });
    }

    await updateStatus();
}

async function updateStatus() {
    if (!statusMessage) {
        clearInterval(statusInterval);
        logger.warn("Can't update status. StatusMessage undefined");
        return;
    }
    if (!bot) {
        clearInterval(statusInterval);
        await statusMessage.edit({
            embeds: [new EmbedBuilder().setTitle("Disconnected")],
        });
        return;
    }

    const dimension = bot.game?.dimension;
    let position = " ";
    if (bot.entity?.position) {
        position = `(${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.y.toFixed(2)}, ${bot.entity.position.z.toFixed(2)})`;
    }
    let hearts = "";
    if (!bot.health) {
        hearts = "🖤".repeat(10);
    } else {
        hearts += "❤️".repeat(Math.floor(bot.health / 2));
        hearts += "💔".repeat(bot.health % 2);
        hearts += "🖤".repeat(10 - Math.ceil(bot.health / 2));
    }

    let saturation = "";
    if (bot.food === undefined) {
        saturation = "🍽️".repeat(10);
    } else {
        saturation += "🍗".repeat(Math.floor(bot.food / 2));
        saturation += "🍗".repeat(bot.food % 2);
        saturation += "🍽️".repeat(10 - Math.ceil(bot.food / 2));
    }

    // const equipment = bot.entity.equipment;
    // if (equipment[1]) {
    //     await bot.unequip("off-hand");
    // }
    // if (equipment[2]) {
    //     await bot.unequip("feet");
    // }
    // if (equipment[3]) {
    //     await bot.unequip("legs");
    // }
    // if (equipment[4]) {
    //     await bot.unequip("torso");
    // }
    // if (equipment[5]) {
    //     await bot.unequip("head");
    // }
    const equipment = bot.entity?.equipment;
    let equipmentText: string;
    if (!equipment) {
        equipmentText = "⏳";
    } else {
        equipmentText = `🪖 ${equipment[5]?.displayName || "None"} `;
        equipmentText += `👕 ${equipment[4]?.displayName || "None"} `;
        equipmentText += `👖 ${equipment[3]?.displayName || "None"} `;
        equipmentText += `👞 ${equipment[2]?.displayName || "None"} `;
        equipmentText += `🫲 ${equipment[1]?.displayName || "None"} `;
    }

    let inventory: string;
    if (bot.inventory.items().length === 0) {
        inventory = "🗑️ Empty";
    } else {
        inventory = bot.inventory
            .items()
            .map((i) => `${i.count}x ${i.displayName}`)
            .join(", ");
    }

    await statusMessage.edit({
        content: "",
        embeds: [
            new EmbedBuilder()
                .setTitle("⛏️ Connected")
                .setDescription(" ")
                .setColor(0x5b8b32)
                .addFields(
                    {
                        name: "Mode",
                        value: bot.mode.name,
                    },
                    { name: "\t", value: "\t" },
                    {
                        name: "🌏 Dimension",
                        value: dimension || " ",
                        inline: true,
                    },
                    {
                        name: "📌 Location",
                        value: (position || " ").toString(),
                        inline: true,
                    },
                    { name: "\t", value: "\t" },
                    {
                        name: "💊 Health",
                        value: hearts,
                        inline: true,
                    },
                    {
                        name: "🍔 Saturation",
                        value: saturation,
                        inline: true,
                    },
                    { name: "\t", value: "\t" },
                    {
                        name: "🔧 Equipment",
                        value: equipmentText,
                    },
                    {
                        name: "📦 Inventory",
                        value: inventory,
                    }
                )
                .setTimestamp(),
        ],
    });
}

async function follow(
    interaction: ChatInputCommandInteraction,
    param: string | null
) {
    const username = z.string().parse(param);
    const player = bot?.players[username];
    if (!player) {
        interaction.reply({
            content: "🔎 player not found",
            ephemeral: true,
        });
        return;
    }
    await bot!.setMode(followMode(bot!, player));
    await interaction.reply({
        content: "🦵 following",
        ephemeral: true,
    });
}

async function goto(
    interaction: ChatInputCommandInteraction,
    param: string | null
) {
    if (!param) {
        interaction.reply({
            content: "❌ missing coordinates",
            ephemeral: true,
        });
        return;
    }
    const coordsArray = param.split(" ");
    const xCoord = z.coerce.number().parse(coordsArray[0]);
    const yCoord = z.coerce.number().parse(coordsArray[1]);
    const zCoord = z.coerce.number().optional().parse(coordsArray[2]);
    await bot!.setMode(gotoMode(bot!, xCoord, yCoord, zCoord));
    if (zCoord) {
        await interaction.reply({
            content: `📌 going to (${xCoord}, ${yCoord}, ${zCoord})`,
        });
    } else {
        await interaction.reply({
            content: `📌 going to (${xCoord}, ${yCoord})`,
        });
    }
}
