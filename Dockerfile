FROM oven/bun

WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install && bun run prisma generate
COPY . .
RUN bunx prisma generate
CMD bun run start
