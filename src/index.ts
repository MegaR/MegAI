import "dotenv/config";
import {
    ApplicationCommandType,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    Message,
    MessageContextMenuCommandInteraction,
    Partials,
    Routes,
    SlashCommandBuilder,
} from "discord.js";
import { MegAI } from "./megai";
import { Session } from "./session.interface";
import { DateTime } from "luxon";
import { tts } from "./tts";
import { getLogger } from "./logger";

const log = getLogger("main");

async function start() {
    const client = await setupDiscord();
    const megAI = new MegAI(client.user?.username!);
    client.on("messageCreate", async (message) => {
        // if (message.author.bot) return;
        if (message.author.id === client.user?.id) return;
        if (message.content === "!ping") {
            await message.reply("Pong!");
        }
        if (
            message.mentions.members?.has(client.user!.id) ||
            message.guild === null
        ) {
            await handleMention(message, megAI);
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand()) return;
        if (interaction.commandName === "reply") {
            if (!interaction.isMessageContextMenuCommand()) return;
            handleReplyCommand(interaction);
        }
        if (interaction.commandName === "remember") {
            if (!interaction.isMessageContextMenuCommand()) return;
            handleRememberCommand(interaction);
        }
        if (interaction.commandName === "recall") {
            if (!interaction.isChatInputCommand()) return;
            handleRecallCommand(interaction);
        }
    });

    async function setupDiscord() {
        log.info("setting up Discord");
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
            ],
            partials: [Partials.Channel, Partials.Message],
        });
        client.on("ready", () => {
            log.info(`Logged in as ${client.user?.tag}!`);
        });
        await client.login(process.env.DISCORD_TOKEN);
        await setupCommands();
        return client;
    }

    function formatPrompt(user: string, message: Message<boolean>) {
        const timestamp = DateTime.fromJSDate(message.createdAt).toFormat(
            "yyyy-MM-dd HH:mm:ss"
        );
        return `[${timestamp}] ${user}: ${message.cleanContent}`;
    }

    async function handleMention(message: Message<boolean>, megAI: MegAI) {
        const reply = await message.reply({
            embeds: [new EmbedBuilder().setTitle("I'm thinking...⌛")],
        });

        try {
            const user = message.author.username;
            const prompt = formatPrompt(user, message);
            log.debug(prompt);
            const session = await megAI.reply(user, prompt, async (s) => {
                await updateMessage(reply, s);
            });
            if (session) {
                const audio = await tts(session.responses.join("\n"));
                session.attachments.push({ file: audio, name: "tts.mp3" });
                await updateMessage(reply, session);
            }
        } catch (error) {
            if ((error as any).response) {
                log.error("network error: ", (error as any)?.response?.data);
            } else {
                log.error(error);
            }
            reply.edit("❌ Something went wrong. 😢");
        }
    }

    async function updateMessage(message: Message<boolean>, session: Session) {
        let embed = new EmbedBuilder();
        let files: AttachmentBuilder[] = [];
        if (session.responses.length > 0) {
            embed = embed.setDescription(session.responses.join("\n"));
        }
        if (session.footer.length > 0) {
            embed = embed.setFooter({ text: session.footer.join("\n") });
        }
        if (session.attachments.length > 0) {
            for (const attachment of session.attachments) {
                const file = new AttachmentBuilder(attachment.file, {
                    name: attachment.name,
                });
                files.push(file);
            }
        }
        await message.edit({
            embeds: [embed],
            files: files,
        });
    }

    async function setupCommands() {
        const replyCommand = {
            name: "reply",
            type: ApplicationCommandType.Message,
        };
        const rememberCommand = {
            name: "remember",
            type: ApplicationCommandType.Message,
        };
        const recallCommand = new SlashCommandBuilder()
            .setName("recall")
            .setDescription("search memory")
            .addStringOption((option) =>
                option
                    .setName("query")
                    .setDescription("search query")
                    .setRequired(true)
            );

        await client.rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: [replyCommand, rememberCommand, recallCommand] }
        );
    }

    async function handleReplyCommand(
        interaction: MessageContextMenuCommandInteraction
    ) {
        const targetMessage = interaction.targetMessage;
        if (targetMessage.author === client.user) {
            await interaction.reply({
                content: "I can't reply to myself!",
                ephemeral: true,
            });
            return;
        }
        if (targetMessage.cleanContent.trim() === "") {
            await interaction.reply({
                content: "I can't reply to this message 😔.",
                ephemeral: true,
            });
            return;
        }
        await interaction.reply({ content: "Replying!", ephemeral: true });
        await handleMention(
            (interaction as MessageContextMenuCommandInteraction).targetMessage,
            megAI
        );
    }

    async function handleRememberCommand(
        interaction: MessageContextMenuCommandInteraction
    ) {
        const targetMessage = interaction.targetMessage;
        if (targetMessage.cleanContent.trim() === "") {
            await interaction.reply({
                content: "I can't remember this message 😔.",
                ephemeral: true,
            });
            return;
        }
        megAI.remember(
            formatPrompt(targetMessage.author.username, targetMessage)
        );
        await interaction.reply({
            content: `remembering`,
            ephemeral: true,
        });
        await targetMessage.reply({
            content: `${client.user?.username} will remember that.`,
        });
    }

    async function handleRecallCommand(
        interaction: ChatInputCommandInteraction
    ) {
        await interaction.deferReply();
        const query = interaction.options.get("query", true);
        const memories = await megAI.recall(query.value as string);
        await interaction.editReply({
            content: "Memories: \n" + memories.map((m) => m.content).join("\n"),
        });
    }
}

start();
