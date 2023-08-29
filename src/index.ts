import "dotenv/config";
import {
    AnyThreadChannel,
    ApplicationCommandType,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    Message,
    MessageContextMenuCommandInteraction,
    Partials,
    Routes,
    SlashCommandBuilder,
    ThreadAutoArchiveDuration,
} from "discord.js";
import { MegAI } from "./megai";
import { Session } from "./session.interface";
import { DateTime } from "luxon";
import { tts } from "./tts";
import { getLogger } from "./logger";
import { startAdventure, AdventureResult, adventureReaction } from "./adventure";

const log = getLogger("main");
const adventureEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

async function start() {
    const client = await setupDiscord();
    await setupCommands();
    const megAI = new MegAI(client.user?.username!);
    client.on(Events.MessageCreate, async (message) => {
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

    client.on(Events.InteractionCreate, async (interaction) => {
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
        if (interaction.commandName === "startadventure") {
            if (!interaction.isChatInputCommand()) return;
            handleStartAdventureCommand(interaction);
        }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) {
            await reaction.fetch();
        }
        const channel = reaction.message.channel;
        if (!channel.isThread()) return;
        if(!reaction.emoji.name) return;
        if (!adventureEmojis.includes(reaction.emoji.name)) return;
        
        const index = adventureEmojis.indexOf(reaction.emoji.name);
        const result = await adventureReaction(channel.id, index);

        if(!result) return;
        // await channel.send({content: `Player chose: ${result?.selectedOption}`});
        await handleAdventureResult(channel, result);
    });

    async function setupDiscord() {
        log.info("setting up Discord");
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
            ],
            partials: [Partials.Channel, Partials.Message, Partials.Reaction],
        });
        client.on(Events.ClientReady, () => {
            log.info(`Logged in as ${client.user?.tag}!`);
        });
        await client.login(process.env.DISCORD_TOKEN);
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
            for (const attachment of session.attachments.slice(-10)) {
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

        const adventureCommand = new SlashCommandBuilder()
            .setName("startadventure")
            .setDescription("Start a adventure session")
            .addStringOption((option) =>
                option
                    .setName("theme")
                    .setDescription("theme of the adventure")
                    .setRequired(true)
            );

        const stopAdventureCommand = new SlashCommandBuilder()
            .setName("stopadventure")
            .setDescription("Stop an active adventure session");

        await client.rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            {
                body: [
                    replyCommand,
                    rememberCommand,
                    recallCommand,
                    adventureCommand,
                    stopAdventureCommand,
                ],
            }
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

    async function handleStartAdventureCommand(
        interaction: ChatInputCommandInteraction
    ) {
        try {
        const theme = interaction.options.get("theme", true);
        const reply = await interaction.reply({
            content: `Starting adventure with theme: ${theme.value}`,
            fetchReply: true,
        });
        const thread = await reply.startThread({
            name: `Adventure: ${theme.value}`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        });
        // await thread.join();

        const result = await startAdventure(thread.id, theme.value as string);
        await handleAdventureResult(thread, result);
        } catch(e) {
            log.error(e);
        }
    }

    async function handleAdventureResult(
        thread: AnyThreadChannel<boolean>,
        result: AdventureResult
    ) {
        try {
            const content =
                `${result.message}\n\n` +
                result.options.map((o, i) => `${i + 1}. ${o}`).join("\n");

            const embed = new EmbedBuilder();
            embed.setDescription(content);

            const message = await thread.send({
                embeds:[embed],
            });
            result.options.forEach((_, i) => {
                message.react(adventureEmojis[i]);
            });

            const audio = await tts(content);
            let attachments: AttachmentBuilder[] = [];
            attachments.push(new AttachmentBuilder(audio, {name: "tts.mp3" }));
            message.edit({embeds: [embed], files: attachments});
        } catch(e) {
            log.error(e);
        }
    }
}

start();
