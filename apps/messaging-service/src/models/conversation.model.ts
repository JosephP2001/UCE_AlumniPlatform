import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: string[];   // userIds
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants:  { type: [String], required: true, index: true },
    lastMessage:   { type: String,   default: null },
    lastMessageAt: { type: Date,     default: null },
  },
  { timestamps: true }
);

// Compound index: quickly find the conversation between two users
ConversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
