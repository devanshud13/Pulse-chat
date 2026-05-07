import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export interface SocketAuthPayload {
  userId: string;
  email: string;
}

export type ObjectId = Types.ObjectId;

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
