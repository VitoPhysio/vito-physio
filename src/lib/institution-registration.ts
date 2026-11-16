import { z } from "zod";

const institutionSignup = z.object({
  name: z.string().trim().min(3).max(160),
  type: z.enum(["school", "club", "academy"]),
  institutionId: z.string().uuid().optional(),
  emailAuthorized: z.literal(true, { message: "Confirm that the institution authorizes this email." }),
  phone: z.string().trim().max(40),
  location: z.string().trim().max(160),
  notes: z.string().trim().max(1000),
  photo: z.string().optional(),
});

export function institutionSignupMetadata(input: z.input<typeof institutionSignup>) {
  const v = institutionSignup.parse(input);
  return {
    requested_role: "school_admin",
    full_name: v.name,
    institution_authorized: true,
    ...(v.institutionId
      ? { join_school_id: v.institutionId }
      : { org_name: v.name, org_type: v.type, org_location: v.location, org_notes: v.notes, avatar_path: v.photo }),
    phone: v.phone,
  };
}