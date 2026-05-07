export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: 'online' | 'offline';
  lastSeen?: string;
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
  createdAt: string;
  updatedAt: string;
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
