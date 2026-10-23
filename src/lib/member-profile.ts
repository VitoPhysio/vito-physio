import { z } from "zod";

export function profileKind(roles: readonly string[]) {
  if (roles.some((role) => ["clinical_professional", "clinical_supervisor"].includes(role))) return "clinical";
  if (roles.some((role) => ["super_admin", "vito_admin"].includes(role))) return "staff";
  if (roles.includes("school_admin")) return "organisation";
  if (roles.includes("coach")) return "coach";
  if (roles.includes("athlete")) return "athlete";
  if (roles.includes("parent")) return "parent";
  return "member";
}

export const memberProfileInput = z.object({
  full_name: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(120),
  position: z.string().trim().max(80),
  sport: z.string().trim().max(80),
  school_name: z.string().trim().max(160),
  team: z.string().trim().max(120),
  district: z.string().trim().max(120),
  country: z.string().trim().max(120),
  bio: z.string().trim().max(1500),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  interests: z.array(z.string().trim().min(1).max(60)).max(20),
  discoverable: z.boolean(),
  visibility: z.enum(["community", "connections"]),
}).strict();
