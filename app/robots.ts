import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

/**
 * Only the marketing and auth-entry pages belong in an index. Everything behind
 * the login — and the API — is kept out: those pages are per-workspace, they
 * redirect signed-out visitors anyway, and having them crawled is noise at best.
 */
export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/create",
          "/calendar",
          "/posts",
          "/analytics",
          "/inbox",
          "/accounts",
          "/media",
          "/ai",
          "/settings",
          "/billing",
          "/onboarding",
          "/invite/",
          "/auth/",
          "/verify-email",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
