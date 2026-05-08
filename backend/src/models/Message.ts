import { Schema, model, Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'file';

export interface IAttachment {
  url: string;
  publicId?: string;
  name: string;
  size: number;
  mime: string;
}

/** Per-recipient encrypted symmetric key. */
export interface IEncryptionKey {
  user: Types.ObjectId;
  /** Base64 ciphertext of the AES key encrypted with this user's RSA-OAEP public key. */
  key: string;
}

/** Envelope describing how `content` was E2E-encrypted (if at all). */
export interface IEncryption {
  enabled: boolean;
  /** Base64 AES-GCM IV. Present only when enabled. */
  iv?: string;
  keys: IEncryptionKey[];
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  type: MessageType;
  /** Plaintext when `encryption.enabled === false`, otherwise base64 AES-GCM ciphertext. */
  content: string;
  attachment?: IAttachment;
  readBy: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];
  edited: boolean;
  /** True when the message was deleted for everyone (tombstone). */
  deleted: boolean;
  /** User ids that hid this message for themselves only. */
  deletedFor: Types.ObjectId[];
  encryption: IEncryption;
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

const encryptionKeySchema = new Schema<IEncryptionKey>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

const encryptionSchema = new Schema<IEncryption>(
  {
    enabled: { type: Boolean, default: false },
    iv: { type: String },
    keys: { type: [encryptionKeySchema], default: [] },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: { type: String, default: '', maxlength: 20000 },
    attachment: { type: attachmentSchema, default: undefined },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    encryption: { type: encryptionSchema, default: () => ({ enabled: false, keys: [] }) },
  },
  { timestamps: true },
);

messageSchema.index({ chat: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', messageSchema);
