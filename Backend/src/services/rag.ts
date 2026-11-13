import Chunk from "../models/Chunk.js";
import { env } from "../config/env.js";
import { cosineSimilarity } from "./document.js";
import { embedQuery } from "./embeddings.js";

const MAX_CHUNKS_SCANNED = 1000;
const MIN_SCORE = 0.15;

export const getRagContext = async (
  userId: string,
  threadId: string,
  question: string
): Promise<string | null> => {
  const chunks = await Chunk.find({ userId, threadId })
    .select("content embedding")
    .limit(MAX_CHUNKS_SCANNED)
    .lean();

  if (chunks.length === 0) {
    return null;
  }

  const queryEmbedding = await embedQuery(question);

  if (queryEmbedding.length === 0) {
    return null;
  }

  const ranked = chunks
    .map((chunk) => ({
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .filter((chunk) => chunk.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, env.RAG_TOP_K);

  if (ranked.length === 0) {
    return null;
  }

  const excerpts = ranked
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join("\n\n");

  return [
    "Use the following document excerpts to answer the user when relevant.",
    "If the answer is not contained in the excerpts, say you could not find it in the uploaded documents.",
    "",
    excerpts
  ].join("\n");
};
