import { describe, expect, it } from "vitest";
import { chunkText, cosineSimilarity, extractText } from "../services/document.js";

describe("document utilities", () => {
  it("extracts plain text files", async () => {
    const text = await extractText(Buffer.from("hello world"), "text/plain");
    expect(text).toBe("hello world");
  });

  it("rejects unsupported file types", async () => {
    await expect(extractText(Buffer.from("x"), "image/png")).rejects.toThrow(/Unsupported/);
  });

  it("chunks long text with overlap", () => {
    const text = "a".repeat(2500);
    const chunks = chunkText(text, 1000, 200);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.length).toBe(1000);
    expect(chunks[1]?.length).toBe(1000);
    expect(chunks[2]?.length).toBe(900);
  });

  it("normalizes whitespace before chunking", () => {
    const chunks = chunkText("hello   world\n\n\n\nsecond   line");
    expect(chunks[0]).toBe("hello world\n\nsecond line");
  });

  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});
