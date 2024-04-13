FROM oven/bun

RUN apt update \
    && apt install -y curl
ARG NODE_VERSION=18
RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n \
    && bash n $NODE_VERSION \
    && rm n \
    && npm install -g n

WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install
COPY . .
RUN patch node_modules/prismarine-auth/src/TokenManagers/XboxTokenManager.js XboxTokenManager.js.patch
RUN bunx prisma generate
CMD bun run start
