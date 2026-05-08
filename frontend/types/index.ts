export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: 'online' | 'offline';
  lastSeen?: string;
  /** Base64 SPKI of the user's RSA-OAEP public key (E2E). */
  publicKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attachment {
  url: string;
  publicId?: string;
  name: string;
  size: number;
  mime: string;
}

export interface MessageEncryptionKey {
  user: string;
  key: string;
}

export interface MessageEncryption {
  enabled: boolean;
  iv?: string;
  keys: MessageEncryptionKey[];
}

export interface Message {
  _id: string;
  chat: string;
  sender: User | string;
  type: 'text' | 'image' | 'file';
  content: string;
  attachment?: Attachment;
  readBy: string[];
  deliveredTo: string[];
  edited: boolean;
  deleted: boolean;
  deletedFor?: string[];
  encryption?: MessageEncryption;
  createdAt: string;
  updatedAt: string;
  /** Client-side only — `true` while the message is being sent (no server _id yet). */
  pending?: boolean;
  /** Client-side only — `true` if the API call failed; UI lets the user retry. */
  failed?: boolean;
  /** Client-side only — cached plaintext after decryption to avoid re-decrypt on every render. */
  plaintext?: string;
}

export interface Chat {
  _id: string;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  members: User[];
  admins: User[];
  createdBy: string;
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface NotificationItem {
  _id: string;
  user: string;
  type: 'message' | 'group_invite' | 'system';
  title: string;
  body: string;
  chat?: string;
  message?: string;
  read: boolean;
  createdAt: string;
}
