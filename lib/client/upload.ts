"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * The browser half of an upload: the server has already authorized it and issued a token for
 * one specific object, so all that is left is to put the bytes there.
 *
 * This is the only request the app makes to Supabase from the browser. It deliberately does not
 * use the tab's own session — see planUpload in lib/services/media.ts for why.
 */
export interface UploadTicket {
  bucket: "media";
  path: string;
  token: string;
}

/**
 * Turns a storage error into something the person reading it can act on. The provider's own
 * wording is kept for anything unrecognised rather than swallowed.
 */
export function uploadFailureMessage(reason: string): string {
  const text = reason.toLowerCase();
  if (text.includes("bucket not found")) {
    return "The media storage bucket is missing on this deployment. An administrator needs to run the storage migration.";
  }
  if (text.includes("payload too large") || text.includes("exceeded the maximum")) {
    return "That file is larger than this deployment allows.";
  }
  if (text.includes("mime") || text.includes("content type")) {
    return "That file type isn't accepted. Use a JPEG, PNG, WebP, GIF or MP4.";
  }
  if (text.includes("already exists")) {
    return "That file was already uploaded. Pick it from the media library.";
  }
  if (text.includes("expired") || text.includes("invalid") || text.includes("jwt")) {
    return "That upload took too long to start and the ticket expired. Try again.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "The upload didn't reach Supabase. Check your connection and try again.";
  }
  return `That upload didn't complete: ${reason}`;
}

/** Uploads one file. Returns null on success, or a message to show the person. */
export async function uploadWithTicket(ticket: UploadTicket, file: File): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  return error ? uploadFailureMessage(error.message) : null;
}
