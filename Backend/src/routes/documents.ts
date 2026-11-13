import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { isValidObjectId } from "mongoose";
import rateLimit from "express-rate-limit";
import Document from "../models/Document.js";
import Chunk from "../models/Chunk.js";
import { requireAuth } from "../middleware/auth.js";
import { threadIdSchema } from "../schemas/chat.js";
import { parse } from "../lib/parse.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { chunkText, extractText, SUPPORTED_MIME_TYPES } from "../services/document.js";
import { embedTexts } from "../services/embeddings.js";

const router = Router();

const MAX_CHUNKS = 200;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new AppError(400, "Unsupported file type. Upload a PDF, TXT, or Markdown file."));
    }
  }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test"
});

const toSummary = (document: {
  _id: unknown;
  filename: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  createdAt?: Date;
}) => ({
  id: String(document._id),
  filename: document.filename,
  mimeType: document.mimeType,
  size: document.size,
  chunkCount: document.chunkCount,
  createdAt: document.createdAt ?? new Date(0)
});

router.use(requireAuth);
router.use(uploadLimiter);

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE"
        ? `File is too large. Maximum size is ${env.MAX_UPLOAD_MB}MB.`
        : err.message;
      return next(new AppError(413, message));
    }

    next(err);
  });
};

router.post("/", handleUpload, async (req, res) => {
  const threadId = typeof req.body?.threadId === "string" ? req.body.threadId : "";
  parse(threadIdSchema, { threadId });

  const file = req.file;

  if (!file) {
    throw new AppError(400, "A file is required");
  }

  const userId = req.user!.id;
  const existingCount = await Document.countDocuments({ userId, threadId });

  if (existingCount >= env.MAX_DOCUMENTS_PER_THREAD) {
    throw new AppError(400, `You can attach at most ${env.MAX_DOCUMENTS_PER_THREAD} documents per chat.`);
  }

  const text = await extractText(file.buffer, file.mimetype);

  if (!text.trim()) {
    throw new AppError(400, "Could not extract any text from this file.");
  }

  const pieces = chunkText(text);

  if (pieces.length === 0) {
    throw new AppError(400, "Could not extract any text from this file.");
  }

  if (pieces.length > MAX_CHUNKS) {
    throw new AppError(413, "This document is too large to index. Please upload a smaller file.");
  }

  const embeddings = await embedTexts(pieces);

  const document = await Document.create({
    userId,
    threadId,
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    chunkCount: pieces.length
  });

  try {
    await Chunk.insertMany(
      pieces.map((content, index) => ({
        userId,
        documentId: document._id,
        threadId,
        index,
        content,
        embedding: embeddings[index]
      }))
    );
  } catch (err) {
    await Document.deleteOne({ _id: document._id });
    throw err;
  }

  res.status(201).json({ document: toSummary(document) });
});

router.get("/", async (req, res) => {
  const threadId = typeof req.query.threadId === "string" ? req.query.threadId : "";
  parse(threadIdSchema, { threadId });

  const documents = await Document.find({ userId: req.user!.id, threadId })
    .sort({ createdAt: -1 });

  res.json(documents.map(toSummary));
});

router.delete("/:documentId", async (req, res) => {
  const { documentId } = req.params;

  if (!documentId || !isValidObjectId(documentId)) {
    throw new AppError(400, "Invalid document id");
  }

  const deleted = await Document.findOneAndDelete({
    _id: documentId,
    userId: req.user!.id
  });

  if (!deleted) {
    throw new AppError(404, "Document not found");
  }

  await Chunk.deleteMany({ documentId: deleted._id });

  res.json({ success: "Document deleted successfully" });
});

export default router;
