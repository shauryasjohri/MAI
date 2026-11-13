import { Schema, model, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 32000
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const threadSchema = new Schema(
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
    title: {
      type: String,
      default: "New Chat",
      maxlength: 200
    },
    messages: {
      type: [messageSchema],
      default: []
    }
  },
  { timestamps: true }
);

threadSchema.index({ userId: 1, threadId: 1 }, { unique: true });
threadSchema.index({ userId: 1, updatedAt: -1 });

export type Message = InferSchemaType<typeof messageSchema>;

export default model("Thread", threadSchema);
