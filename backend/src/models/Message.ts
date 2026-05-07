import { Schema, model, Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'file';

export interface IAttachment {
  url: string;
  publicId?: string;
  name: string;
  size: number;
  mime: string;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  type: MessageType;
  content: string;
  attachment?: IAttachment;
  readBy: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];
  edited: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mime: { type: String, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: { type: String, default: '', maxlength: 5000 },
    attachment: { type: attachmentSchema, default: undefined },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index({ chat: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', messageSchema);
