import {
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Message,
    SlashCommandBuilder,
} from "discord.js";
import Command from "../commands/command.interface";
import mineflayer, { Player } from "mineflayer";
import { getLogger } from "../logger";
import { pathfinder } from "mineflayer-pathfinder";
import { Block } from "prismarine-block";
import armorManager from "mineflayer-armor-manager";
import autoeat from "mineflayer-auto-eat";
import mineflayerTool from "mineflayer-tool";
import { z } from "zod";
import BotMode from "./mode.interface";
import idleMode from "./idle.mode";
import followMode from "./follow.mode";
import gotoMode from "./goto.mode";
import commandStickPlugin from "./commandStick.plugin";

const logger = getLogger("minecraft");
let bot: mineflayer.Bot | undefined;
let mode: BotMode = idleMode;
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
        host: "192.168.2.101",
        port: 1234,
        version: "1.20.1",
        username: "raalders.28@gmail.com",
        auth: "microsoft",
    });
    bot.loadPlugins([
        pathfinder,
        armorManager,
        autoeat.plugin,
        mineflayerTool.plugin,
        commandStickPlugin,
    ]);
    await setMode(idleMode);

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
}

async function disconnect(interaction: ChatInputCommandInteraction) {
    if (!bot) {
        return;
    }
    await mode.stop();
    bot.quit();
    bot = undefined;
    await updateStatus();
    statusMessage = undefined;
    await interaction.reply({ content: "❌ Disconnected", ephemeral: true });
    await updateStatus();
}

async function setMode(newMode: BotMode) {
    if (!bot) {
        throw new Error("Bot not set yet");
    }
    await mode.stop();
    mode = newMode;
    await mode.start(bot);
    await updateStatus();
}

async function handleStickCommand(block: Block | undefined, player: Player) {
    if (block) {
        console.log(block);
        setMode(
            gotoMode(block.position.x, block.position.y + 1, block.position.z)
        );
        return;
    }

    //toggle follow
    if (mode.name === "🦵 Follow") {
        setMode(idleMode);
    } else {
        setMode(followMode(player));
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

    const dimension = bot.game.dimension;
    let position = " ";
    if (bot.entity?.position) {
        position = `(${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.y.toFixed(2)}, ${bot.entity.position.z.toFixed(2)})`;
    }
    await statusMessage.edit({
        embeds: [
            new EmbedBuilder()
                .setTitle("⛏️ Connected")
                .setDescription(" ")
                .addFields(
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
                    {
                        name: "Mode",
                        value: mode.name,
                    }
                ),
        ],
        content: "",
    });
}

async function follow(
    interaction: ChatInputCommandInteraction,
    param: string | null
) {
    const username = z.string().parse(param);
    const player = bot!.players[username];
    if (!player) {
        interaction.reply({
            content: "🔎 player not found",
            ephemeral: true,
        });
        return;
    }
    await setMode(followMode(player));
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
    await setMode(gotoMode(xCoord, yCoord, zCoord));
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
