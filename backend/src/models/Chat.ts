import { Schema, model, Document, Types } from 'mongoose';

export interface IChat extends Document {
  _id: Types.ObjectId;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  members: Types.ObjectId[];
  admins: Types.ObjectId[];
  createdBy: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    isGroup: { type: Boolean, default: false, index: true },
    name: { type: String, trim: true, maxlength: 80 },
    avatar: { type: String, default: '' },
    description: { type: String, default: '', maxlength: 300 },
    members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true },
);

chatSchema.index({ members: 1, updatedAt: -1 });

export const Chat = model<IChat>('Chat', chatSchema);
