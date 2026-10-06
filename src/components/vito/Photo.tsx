import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateLinkedPhoto, uploadPhoto } from '@/lib/photo.functions';
import { cn } from '@/lib/utils';

export function PhotoAvatar({ path, name, className }: { path?: string | null | undefined; name?: string | null | undefined; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ['avatar', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => (await supabase.storage.from('avatars').createSignedUrl(path!, 3600)).data?.signedUrl ?? null,
  });
  const initials = (name ?? '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-primary', className)}>
      {url ? <img src={url} alt={name ?? 'Photo'} className="size-full object-cover" /> : initials}
    </span>
  );
}

export async function fileToPhotoPath(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a PNG, JPG or WEBP photo.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Photo must be under 2MB.');
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return uploadPhoto({ data: { base64: btoa(bin), contentType: file.type as 'image/png' } });
}

export function PhotoPicker({ name = 'photo', label = 'Profile picture' }: { name?: string; label?: string }) {
  const [preview, setPreview] = useState('');
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <span className="inline-flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-primary/40 bg-secondary text-xs text-primary">
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : 'Photo'}
      </span>
      <span><span className="font-medium">{label}</span><br /><span className="text-xs text-muted-foreground">Optional · PNG/JPG, max 2MB</span></span>
      <input type="file" name={name} accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : ''); }} />
    </label>
  );
}

export function EditablePhoto({ path, name, target, targetId, onUpdated, label = 'Change photo' }: { path?: string | null; name?: string | null; target: 'profile' | 'athlete' | 'organisation'; targetId: string; onUpdated?: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div className="flex items-center gap-3">
      <PhotoAvatar path={path} name={name} className="size-16 border-2 border-card" />
      <label className="cursor-pointer text-sm font-semibold text-primary">
        {busy ? 'Uploading…' : label}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true); setMessage('');
          try {
            const nextPath = await fileToPhotoPath(file);
            await updateLinkedPhoto({ data: { target, targetId, path: nextPath } });
            setMessage('Photo updated.'); onUpdated?.();
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
          finally { setBusy(false); e.target.value = ''; }
        }} />
      </label>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
