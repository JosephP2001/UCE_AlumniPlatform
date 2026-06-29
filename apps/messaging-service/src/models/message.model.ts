import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId:       { type: String, required: true },
    recipientId:    { type: String, required: true },
    content:        { type: String, required: true, maxlength: 4000 },
    readAt:         { type: Date,   default: null },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
