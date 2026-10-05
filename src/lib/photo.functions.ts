import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

// Public: used during registration before an account exists. Images only, max 2MB.
export const uploadPhoto = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ base64: z.string().max(2_900_000), contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']) }).parse(input))
  .handler(async ({ data }) => {
    const bytes = Buffer.from(data.base64, 'base64');
    if (bytes.length > 2 * 1024 * 1024) throw new Error('Photo must be under 2MB.');
    const path = `uploads/${crypto.randomUUID()}.${TYPES[data.contentType]}`;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.storage.from('avatars').upload(path, bytes, { contentType: data.contentType });
    if (error) throw new Error('Photo could not be uploaded.');
    return path;
  });
