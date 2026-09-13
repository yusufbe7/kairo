import type { AccountStatus, Platform } from "./database";

export type PlatformId = Platform;

export interface AccountView {
  id: string;
  platform: PlatformId;
  handle: string;
  displayName: string | null;
  followers: number | null;
  status: AccountStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  isDemo: boolean;
}

export interface ConversationView {
  id: string;
  platform: PlatformId;
  name: string;
  handle: string | null;
  preview: string;
  lastMessageAt: string | null;
  unread: number;
}
export interface MessageView { id: string; me: boolean; text: string; sentAt: string }
