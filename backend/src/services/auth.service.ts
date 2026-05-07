import { User, IUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { LoginInput, SignupInput } from '../validators/auth';

export interface AuthResult {
  user: Omit<IUser, 'password' | 'refreshTokens'>;
  accessToken: string;
  refreshToken: string;
}

const issueTokens = (user: IUser): { accessToken: string; refreshToken: string } => {
  const payload = { userId: user._id.toString(), email: user.email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

export const signupService = async (input: SignupInput): Promise<AuthResult> => {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('Email already registered');

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  const tokens = issueTokens(user);
  user.refreshTokens = [tokens.refreshToken];
  await user.save();

  const safe = user.toJSON() as unknown as AuthResult['user'];
  return { user: safe, ...tokens };
};

export const loginService = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email }).select('+password +refreshTokens');
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const ok = await user.comparePassword(input.password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const tokens = issueTokens(user);
  user.refreshTokens = [...(user.refreshTokens ?? []).slice(-4), tokens.refreshToken];
  user.status = 'online';
  user.lastSeen = new Date();
  await user.save();

  const safe = user.toJSON() as unknown as AuthResult['user'];
  return { user: safe, ...tokens };
};

export const refreshService = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await User.findById(payload.userId).select('+refreshTokens');
  if (!user || !user.refreshTokens?.includes(refreshToken)) {
    throw ApiError.unauthorized('Refresh token revoked');
  }
  const tokens = issueTokens(user);
  user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken).concat(tokens.refreshToken);
  await user.save();
  return tokens;
};

export const logoutService = async (userId: string, refreshToken: string): Promise<void> => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  user.refreshTokens = (user.refreshTokens ?? []).filter((t) => t !== refreshToken);
  user.status = 'offline';
  user.lastSeen = new Date();
  await user.save();
};
