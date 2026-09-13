import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

/** The pages a signed-out visitor can actually open. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const lastModified = new Date();
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/register`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
