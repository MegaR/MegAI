import "dotenv/config";
import {
    ApplicationCommandType,
    AttachmentBuilder,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    Message,
    MessageContextMenuCommandInteraction,
    Partials,
    Routes,
} from "discord.js";
import { MegAI } from "./megai";
import { Session } from "./session.interface";
import { DateTime } from "luxon";
import { getLogger } from "./logger";
import { handleAdventureReactions, startAdventureCommand } from "./commands/adventure.command";
import { instructCommand } from "./commands/instruct.command";
import { summaryCommand } from "./commands/summary.command";
import { dalleCommand } from "./commands/dalle.command";

const log = getLogger("main");

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
        if (interaction.commandName === "startadventure") {
            if (!interaction.isChatInputCommand()) return;
            startAdventureCommand.handleCommand(client, interaction);
        }
        if (interaction.commandName === "instruct") {
            if (!interaction.isChatInputCommand()) return;
            instructCommand.handleCommand(client, interaction);
        }
        if (interaction.commandName === "summary") {
            if (!interaction.isChatInputCommand()) return;
            summaryCommand.handleCommand(client, interaction);
        }
        if (interaction.commandName === "image") {
            if(!interaction.isChatInputCommand()) return;
            dalleCommand.handleCommand(client, interaction);
        }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        handleAdventureReactions(reaction);
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
            const userId = message.author.id;
            const channelId = message.channel.id;
            const prompt = formatPrompt(user, message);
            let attachments = [];
            for (const attachment of message.attachments) {
                const data = await (await fetch(attachment[1].url)).arrayBuffer();
                const name = attachment[1].name;
                attachments.push({name, data});
            }
            log.debug(prompt);
            await megAI.reply(channelId, userId, prompt, attachments, async (s) => {
                await updateMessage(reply, s);
            });
            // if (session) {
            //     const audio = await tts(session.responses.join("\n"));
            //     session.attachments.push({ file: audio, name: "tts.mp3" });
            //     await updateMessage(reply, session);
            // }
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

        await client.rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            {
                body: [
                    replyCommand,
                    startAdventureCommand.definition,
                    instructCommand.definition,
                    summaryCommand.definition,
                    dalleCommand.definition,
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

} 

start();
