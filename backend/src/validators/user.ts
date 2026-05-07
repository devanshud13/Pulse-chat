import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  bio: z.string().max(200).optional(),
  avatar: z.string().url().optional(),
});

export const searchUsersSchema = z.object({
  q: z.string().trim().min(1).max(100),
});
