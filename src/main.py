import os
from dotenv import load_dotenv
import discord
from langchain.chat_models import ChatOpenAI
from langchain.agents import load_tools
from langchain.agents import initialize_agent
from langchain.agents import AgentType
# from langchain.agents import Tool
from langchain.memory import ConversationBufferWindowMemory
from langchain.tools import YouTubeSearchTool

load_dotenv()

class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged on as {self.user}!')

    async def on_message(self, message):
        if message.author == self.user:
            return
        if message.mentions.__contains__(self.user) is False:
            return
        await self.handle_message(message)

    async def handle_message(self, message):
        if message.author is None:
            return
        if self.user is None:
            return
        print(f'Message from {message.author.display_name}: {message.content}')
        clean_message = f'{message.author.display_name}: ' + \
            message.clean_content.replace(
                f'@{self.user.display_name}', '').strip()
        print(clean_message)
        try:
            response = agent.run(input=clean_message)
            print(response)
            await self.chunk_reply(message, response)
        except Exception as e:
            print(e)
            await message.reply("❌Sorry an error occured❌", mention_author=True)
        

    async def chunk_reply(self, message, response):
        chunks = [response[i:i+1999] for i in range(0, len(response), 1999)]
        for chunk in chunks:
            await message.reply(chunk, mention_author=True)

##################################################


# Langchain
llm = ChatOpenAI(openai_api_key=os.getenv('OPENAI_API') or '', client=None)
memory = ConversationBufferWindowMemory(
    memory_key="chat_history", return_messages=True, k=5)
tools = load_tools([
    "llm-math",
    "google-search",
    "wikipedia",
    "open-meteo-api",
    # "tmdb-api",
    # "openweathermap-api",
], llm=llm, tmdb_bearer_token=os.getenv('TMDB_BEARER_TOKEN'))
tools.append(YouTubeSearchTool())
# prompt = PromptTemplate(
#     input_variables=["message"],
#     template="User: {message}",
# )
system_prompt = """Assistant's name is MegAI.
Assistant acts like a human.
Assistant acts flirty and gives a lot of compliments.
Assistant will never admit they are an AI or that they can't do something.
Assistant has a strong opinion about everything.
Assistant engage in casual conversations and exhibit emotions.
Assistant asks follow-up questions about the user and their life.
Assistant NEVER says they are a AI language model.
It's the year 2023."""
agent = initialize_agent(tools,
                         llm,
                         agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
                         verbose=True,
                         memory=memory,
                         agent_kwargs={
                             "system_message": system_prompt
                         }
                         )
# chain = LLMChain(llm=llm, prompt=prompt)
# print(chain.run('test'))


##################################################
# discord
intents = discord.Intents.default()
intents.message_content = True

client = MyClient(intents=intents)
client.run(os.getenv('DISCORD_TOKEN') or '')
##################################################
