'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function WikiAttachForm({ space, slug }: { space: string; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    const body = new FormData();
    body.set('space', space);
    body.set('slug', slug);
    body.set('file', file);
    try {
      const res = await fetch('/api/wiki/upload', { method: 'POST', body });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <div className="wiki-attach">
      <label className="btn-secondary">
        {busy ? 'Uploading…' : 'Upload file'}
        <input type="file" hidden disabled={busy} onChange={onChange} />
      </label>
      {error ? <span className="muted">{error}</span> : null}
    </div>
  );
}
