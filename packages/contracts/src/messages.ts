import { z } from 'zod';
import { YoutubeId } from './api.js';

/** Mensajes runtime entre content script, background y side panel (contracts/api.md). */
export const VideoState = z.object({
  type: z.literal('video:state'),
  tabId: z.number().int(),
  videoId: YoutubeId.nullable(),
  currentTime: z.number().nonnegative(),
  paused: z.boolean(),
});

export const VideoNavigated = z.object({
  type: z.literal('video:navigated'),
  tabId: z.number().int(),
  videoId: YoutubeId.nullable(),
});

export const VideoSeek = z.object({
  type: z.literal('video:seek'),
  requestId: z.string(),
  videoId: YoutubeId,
  seconds: z.number().nonnegative(),
});

export const VideoGetState = z.object({ type: z.literal('video:getState'), requestId: z.string() });

export const SeekResult = z.object({ requestId: z.string(), ok: z.boolean(), currentTime: z.number() });

export const ExtensionMessage = z.discriminatedUnion('type', [
  VideoState,
  VideoNavigated,
  VideoSeek,
  VideoGetState,
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessage>;

/** Lo que emite el content script: no conoce su tabId; el receptor lo toma de `sender.tab.id`. */
export const ContentMessage = z.discriminatedUnion('type', [
  VideoState.omit({ tabId: true }),
  VideoNavigated.omit({ tabId: true }),
]);
export type ContentMessage = z.infer<typeof ContentMessage>;
export type VideoGetState = z.infer<typeof VideoGetState>;
export type VideoState = z.infer<typeof VideoState>;
export type VideoSeek = z.infer<typeof VideoSeek>;
export type SeekResult = z.infer<typeof SeekResult>;
