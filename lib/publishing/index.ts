import "server-only";
import { PROVIDERS } from "@/lib/integrations/registry";
import type { PublishRequest, PublishResult, Publisher } from "./types";
import type { PlatformId } from "@/types/social";

export type { PublishRequest, PublishResult, Publisher };

/**
 * Central publishing abstraction. `publishToPlatform` looks up the provider module for a
 * platform and delegates. No platform is registered until its integration is actually built,
 * so an unimplemented provider fails loudly and honestly instead of silently "succeeding".
 *
 * To add one: create lib/integrations/<platform>/publish.ts exporting a Publisher, register it
 * below, and flip `capabilities.publish` to true in lib/integrations/registry.ts.
 */
const PUBLISHERS: Partial<Record<PlatformId, () => Promise<Publisher>>> = {
  facebook: async () => (await import("@/lib/integrations/facebook/publish")).facebookPublisher,
  instagram: async () => (await import("@/lib/integrations/instagram/publish")).instagramPublisher,
};

export async function publishToPlatform(request: PublishRequest): Promise<PublishResult> {
  const definition = PROVIDERS[request.platform];
  const load = PUBLISHERS[request.platform];

  if (!load || !definition.capabilities.publish) {
    return {
      success: false,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: `Publishing to ${request.platform} isn't implemented in this deployment yet.`,
      retryable: false,
    };
  }

  const missing = definition.requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    return {
      success: false,
      errorCode: "NOT_CONFIGURED",
      errorMessage: `${request.platform} is missing API credentials (${missing.join(", ")}).`,
      retryable: false,
    };
  }

  try {
    const publisher = await load();
    return await publisher.publish(request);
  } catch (error) {
    return {
      success: false,
      errorCode: "PROVIDER_ERROR",
      errorMessage: error instanceof Error ? error.message : "The provider rejected this request.",
      retryable: true,
    };
  }
}
