FROM oven/bun

WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install
COPY . .
RUN bunx --bun prisma generate
CMD bun run start
