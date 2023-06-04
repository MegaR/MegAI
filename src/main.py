import os
from dotenv import load_dotenv
import discord
from langchain.chat_models import ChatOpenAI
from langchain.agents import load_tools
from langchain.agents import initialize_agent
from langchain.agents import AgentType
from langchain.agents import Tool
from langchain.memory import ConversationBufferMemory

load_dotenv()

class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged on as {self.user}!')

    async def on_message(self, message):
        if message.author == self.user:
            return
        if message.mentions.__contains__(self.user) == False:
            return
        await self.handle_message(message)
        
    async def handle_message(self, message):
        if message.author is None:
            return
        if self.user is None:
            return
        print(f'Message from {message.author.display_name}: {message.content}')
        clean_message = message.clean_content.replace(f'@{self.user.display_name}', '').strip()
        response = agent.run(input = clean_message)
        print(response)
        await self.chunk_reply(message, response)


    async def chunk_reply(self, message, response):
        chunks = [response[i:i+1999] for i in range(0, len(response), 1999)]
        for chunk in chunks:
            await message.reply(chunk, mention_author=True)

##################################################

# Langchain

llm = ChatOpenAI(openai_api_key=os.getenv('OPENAI_API') or '', client=None)
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
tools = load_tools(["llm-math", "google-search"], llm = llm)

# prompt = PromptTemplate(
#     input_variables=["message"],
#     template="User: {message}",
# )
agent = initialize_agent(tools, llm, agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION, verbose=True, memory=memory)
# chain = LLMChain(llm=llm, prompt=prompt)
# print(chain.run('test'))


##################################################
# discord
intents = discord.Intents.default()
intents.message_content = True

client = MyClient(intents=intents)
client.run(os.getenv('DISCORD_TOKEN') or '')
##################################################