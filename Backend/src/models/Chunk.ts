import { Schema, model } from "mongoose";

const chunkSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true
    },
    threadId: {
      type: String,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      required: true
    }
  },
  { timestamps: true }
);

chunkSchema.index({ userId: 1, threadId: 1 });
chunkSchema.index({ documentId: 1 });

export default model("Chunk", chunkSchema);
