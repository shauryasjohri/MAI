import { Schema, model } from "mongoose";

const documentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    threadId: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true,
      maxlength: 255
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    chunkCount: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1, threadId: 1, createdAt: -1 });

export default model("Document", documentSchema);
