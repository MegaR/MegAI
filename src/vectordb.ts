import { PrismaClient } from "@prisma/client";

interface MemoryObject {
    content: string;
}

let prisma = new PrismaClient();

export async function saveMemory(content: string, embedding: number[]) {
    const embeddingSql = toSql(embedding);
    await prisma.$queryRaw`INSERT INTO "Memory" (content, embedding) VALUES (${content}, ${embeddingSql}::vector);`;
}

export async function getNearestMemories(
    embedding: number[],
    num: number = 10
): Promise<MemoryObject[]> {
    const embeddingSql = toSql(embedding);
    return await prisma.$queryRaw`SELECT content FROM "Memory" ORDER BY embedding <-> ${embeddingSql}::vector LIMIT ${num};`;
}

function fromSql(value: string) {
    return value
        .substring(1, value.length - 1)
        .split(",")
        .map((v) => parseFloat(v));
}

function toSql(value: number[]) {
    return JSON.stringify(value);
}
