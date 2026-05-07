import type { Message } from '@/types';

/** Stable empty references — never use `?? []` inline in Zustand selectors or effect deps. */
export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_STRING_ARRAY: string[] = [];
