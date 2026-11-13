import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    passwordHash: {
      type: String,
      required: false
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    displayName: {
      type: String,
      maxlength: 120
    }
  },
  { timestamps: true }
);

export default model("User", userSchema);
