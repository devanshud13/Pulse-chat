import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthPayload } from '../types';

export const signAccessToken = (payload: AuthPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const signRefreshToken = (payload: AuthPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): AuthPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthPayload;
  return { userId: decoded.userId, email: decoded.email };
};

export const verifyRefreshToken = (token: string): AuthPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload & AuthPayload;
  return { userId: decoded.userId, email: decoded.email };
};
