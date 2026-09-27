'use client';

import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { POST } from '@/lib/config';

/** Shrinks a photo in the browser before upload (the server re-encodes and strips EXIF again). */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, POST.photo.maxDimensionPx / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', POST.photo.jpegQuality));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // e.g. HEIC in browsers that can't decode it: the server handles it
  }
}

export function PhotoInput({ value, onChange }: { value: File | null; onChange: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return setPreview(null);
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  if (preview)
    return (
      <div className="relative">
        <img src={preview} alt="รูปที่แนบ" className="max-h-48 w-full rounded-2xl object-cover" />
        <button
          type="button"
          aria-label="เอารูปออก"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/55 text-white"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    );

  return (
    <label className="flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-tertiary text-[14px] font-semibold text-link hover:bg-fill/50">
      แนบรูป (ไม่บังคับ)
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await shrink(f));
        }}
      />
    </label>
  );
}
