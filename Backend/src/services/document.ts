import { PDFParse } from "pdf-parse";
import { AppError } from "../lib/errors.js";

export const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown"
]);

export const extractText = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf8");
  }

  throw new AppError(400, "Unsupported file type. Upload a PDF, TXT, or Markdown file.");
};

export const chunkText = (text: string, size = 1000, overlap = 200): string[] => {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end === normalized.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
