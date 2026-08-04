'use client';

import { useEffect, useState } from 'react';
import { ImageOff, Link2, LoaderCircle, UploadCloud, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { imageAcceptValue, normalizeImageFile, safeImageFileName } from '@/lib/imageFiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GuidedLabel } from '@/components/evidara/question-help';

export function QuestionImageField({
  label,
  value,
  onChange,
  help,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  async function upload(file: File) {
    if (!supabase || !user) {
      setMessage('Sign in to Supabase before uploading an image. A public Cloudflare or other HTTPS URL can still be pasted.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { blob, mime } = await normalizeImageFile(file);
      const safeName = safeImageFileName(file.name);
      const path = `${user.id}/questions/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from('question-assets')
        .upload(path, blob, { upsert: false, contentType: mime, cacheControl: '3600' });
      if (error) throw error;
      const { data } = supabase.storage.from('question-assets').getPublicUrl(path);
      onChange(data.publicUrl);
      setMessage('Uploaded to the Evidara question-assets bucket.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <GuidedLabel help={help}>{label}</GuidedLabel>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
          <Input
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://imagedelivery.net/... or another public HTTPS image"
            className="min-w-0 border-[#E7ECEB] pl-9 pr-9"
          />
          {value && (
            <button
              type="button"
              aria-label="Remove image link"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#6B7980] hover:bg-[#E7ECEB]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <label className="block w-full sm:w-auto">
          <Button type="button" variant="outline" asChild className="w-full border-[#E7ECEB] sm:w-auto">
            <span className="cursor-pointer whitespace-nowrap">
              {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload
            </span>
          </Button>
          <input
            type="file"
            hidden
            accept={imageAcceptValue}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {value && (
        <div className={`overflow-hidden rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] ${compact ? 'max-w-xs p-2' : 'p-3'}`}>
          {previewFailed ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-[#B54747]">
              <ImageOff className="h-4 w-4" />
              The URL could not be previewed. Confirm it is public, HTTPS and allows browser access.
            </div>
          ) : (
            <img
              src={value}
              alt={`${label} preview`}
              onError={() => setPreviewFailed(true)}
              className={`${compact ? 'max-h-28' : 'max-h-72'} mx-auto w-auto max-w-full rounded-lg object-contain`}
            />
          )}
        </div>
      )}
      {message && <p className={`break-words text-xs ${message.includes('Uploaded') ? 'text-[#0E5A5A]' : 'text-[#B54747]'}`}>{message}</p>}
    </div>
  );
}
