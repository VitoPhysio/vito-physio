import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

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

export const updateLinkedPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    target: z.enum(['profile', 'athlete', 'organisation', 'community-cover']),
    targetId: z.string().uuid(),
    path: z.string().regex(/^uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const isSelf = ['profile', 'community-cover'].includes(data.target) && data.targetId === context.userId;
    const { data: staff } = await context.supabase.rpc('is_vito_staff', { _user_id: context.userId });
    let allowed = isSelf || Boolean(staff);
    if (!allowed && data.target === 'athlete') {
      const { data: links } = await context.supabase.from('athlete_guardians').select('id').eq('user_id', context.userId).eq('athlete_id', data.targetId).limit(1);
      allowed = Boolean(links?.length);
    }
    if (!allowed && data.target === 'organisation') {
      const { data: links } = await context.supabase.from('school_users').select('id').eq('user_id', context.userId).eq('school_id', data.targetId).limit(1);
      allowed = Boolean(links?.length);
    }
    if (!allowed) throw new Error('You cannot change this photo.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const admin = supabaseAdmin as any;
    const query = data.target === 'profile'
      ? admin.from('profiles').update({ avatar_path: data.path }).eq('id', data.targetId)
      : data.target === 'community-cover'
        ? admin.from('community_profiles').upsert({ user_id: data.targetId, cover_path: data.path }, { onConflict: 'user_id' })
        : data.target === 'athlete'
          ? admin.from('athletes').update({ photo_path: data.path }).eq('id', data.targetId)
          : admin.from('schools').update({ logo_path: data.path }).eq('id', data.targetId);
    const { error } = await query;
    if (error) throw new Error('Photo could not be updated.');
    return { ok: true };
  });
