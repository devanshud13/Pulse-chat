import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  bio?: string;
  status: 'online' | 'offline';
  lastSeen: Date;
  refreshTokens: string[];
  /** Base64-encoded SPKI of the user's RSA-OAEP-2048 public key (used for E2E). */
  publicKey?: string;
  /** PKCS#8 of the user's private key, AES-GCM-encrypted with a key derived from
   *  their password (PBKDF2). The server can never decrypt this. Sync'd across
   *  devices so any browser the user logs in on can recover the same key pair. */
  encryptedPrivateKey?: string;
  /** Base64 PBKDF2 salt used to derive the password-key for `encryptedPrivateKey`. */
  keySalt?: string;
  /** Base64 IV used to AES-GCM-encrypt `encryptedPrivateKey`. */
  keyIv?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 200 },
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    lastSeen: { type: Date, default: Date.now },
    refreshTokens: { type: [String], default: [], select: false },
    publicKey: { type: String, default: '' },
    encryptedPrivateKey: { type: String, default: '', select: false },
    keySalt: { type: String, default: '', select: false },
    keyIv: { type: String, default: '', select: false },
  },
  { timestamps: true },
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.password;
    delete obj.refreshTokens;
    delete obj.__v;
    return obj;
  },
});

export const User = model<IUser>('User', userSchema);
