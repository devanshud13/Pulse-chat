import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType = 'message' | 'group_invite' | 'system';

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  chat?: Types.ObjectId;
  message?: Types.ObjectId;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['message', 'group_invite', 'system'], default: 'message' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    chat: { type: Schema.Types.ObjectId, ref: 'Chat' },
    message: { type: Schema.Types.ObjectId, ref: 'Message' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
