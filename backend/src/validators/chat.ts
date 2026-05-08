import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const oneToOneSchema = z.object({
  userId: objectId,
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  members: z.array(objectId).min(1),
  description: z.string().max(300).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(300).optional(),
  avatar: z.string().url().optional(),
});

export const memberActionSchema = z.object({
  userId: objectId,
});

export const sendMessageSchema = z.object({
  chatId: objectId,
  content: z.string().max(20000).optional().default(''),
  type: z.enum(['text', 'image', 'file']).optional().default('text'),
  attachment: z
    .object({
      url: z.string().url(),
      publicId: z.string().optional(),
      name: z.string(),
      size: z.number().int().nonnegative(),
      mime: z.string(),
    })
    .optional(),
  encryption: z
    .object({
      enabled: z.boolean(),
      iv: z.string().optional(),
      keys: z
        .array(
          z.object({
            user: objectId,
            key: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(20000),
  encryption: z
    .object({
      enabled: z.boolean(),
      iv: z.string().optional(),
      keys: z
        .array(
          z.object({
            user: objectId,
            key: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
