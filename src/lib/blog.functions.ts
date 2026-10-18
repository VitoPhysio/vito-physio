import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IMAGE_TYPES = {
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes: Buffer) =>
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes: Buffer) =>
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes: Buffer) =>
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP",
  },
} as const;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export const uploadBlogArticleImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        base64: z.string().min(1).max(8_500_000),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Your writing permission could not be verified.");
    const writerRoles = [
      "super_admin",
      "vito_admin",
      "clinical_professional",
      "clinical_supervisor",
    ];
    if (!roleRows?.some(({ role }) => writerRoles.includes(role))) {
      throw new Error("Only clinicians and administrators can upload article photos.");
    }

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("Article photos must be 6 MB or smaller.");
    }
    const imageType = IMAGE_TYPES[data.contentType];
    if (!imageType.signature(bytes)) {
      throw new Error("The uploaded file does not match its image type. Use PNG, JPG or WEBP.");
    }

    const path = `articles/${context.userId}/${crypto.randomUUID()}.${imageType.extension}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("blog-images")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (uploadError) {
      console.error("[blog] article photo upload failed", uploadError);
      throw new Error("The article photo could not be uploaded. Please try again.");
    }

    const { data: publicUrl } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);
    return publicUrl.publicUrl;
  });
