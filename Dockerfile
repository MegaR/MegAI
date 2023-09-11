FROM oven/bun

WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run prisma generate
CMD bun run start
