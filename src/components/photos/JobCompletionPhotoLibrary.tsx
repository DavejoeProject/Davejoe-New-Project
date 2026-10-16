
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  Images,
  Download,
  RefreshCw,
  Upload,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const BUCKET = 'job-completion-photos';
const MAX_FILE_SIZE = 512000;

type Photo = {
  id: string;
  project_name: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

type Props = {
  canUpload?: boolean;
};

export const JobCompletionPhotoLibrary: React.FC<Props> = ({
  canUpload = false,
}) => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('job_completion_photos')
        .select(
          'id, project_name, description, storage_path, file_name, mime_type, file_size_bytes, created_at',
        )
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      const records = (data ?? []) as Photo[];
      const urlEntries = await Promise.all(
        records.map(async (photo) => {
          const { data: urlData, error: urlError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(photo.storage_path, 300);

          if (urlError || !urlData?.signedUrl) {
            return [photo.id, ''] as const;
          }

          return [photo.id, urlData.signedUrl] as const;
        }),
      );

      setPhotos(records);
      setSignedUrls(Object.fromEntries(urlEntries));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the photo library. Check your access and connection.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!canUpload || !user) {
      setError('You are not permitted to upload photos.');
      return;
    }

    if (!projectName.trim()) {
      setError('Enter the project or job name.');
      return;
    }

    if (!selectedFile) {
      setError('Choose a photo to upload.');
      return;
    }

    if (selectedFile.size <= 0 || selectedFile.size > MAX_FILE_SIZE) {
      setError('The photo must be no larger than 500 KB (512,000 bytes).');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and WebP images are accepted.');
      return;
    }

    setUploading(true);

    try {
      const safeName = selectedFile.name
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .slice(-100);

      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (storageError) throw storageError;

      const { error: metadataError } = await supabase
        .from('job_completion_photos')
        .insert({
          project_name: projectName.trim(),
          description: description.trim() || null,
          storage_path: storagePath,
          file_name: selectedFile.name,
          mime_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
          uploaded_by: user.id,
        });

      if (metadataError) {
        // Remove an uploaded object if its metadata could not be saved.
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw metadataError;
      }

      setProjectName('');
      setDescription('');
      setSelectedFile(null);
      event.currentTarget.reset();
      setNotice('Photo uploaded successfully.');
      await loadPhotos();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'The photo upload failed.',
      );
    } finally {
      setUploading(false);
    }
  };

  const downloadPhoto = async (photo: Photo) => {
    setError('');

    try {
      const { data, error: urlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(photo.storage_path, 300, {
          download: photo.file_name,
        });

      if (urlError || !data?.signedUrl) {
        throw urlError ?? new Error('Could not create a secure download link.');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to download this photo.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">
              Job Completion Photo Library
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Private photo storage. Signed viewing and download links expire
              after five minutes.
            </p>
          </div>
        </div>

        {canUpload && (
          <form onSubmit={handleUpload} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
            <h3 className="font-semibold text-slate-800">Upload a completion photo</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Project or job name
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  required
                  maxLength={200}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Enter project name"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Description (optional)
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1000}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Brief description"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Photo (JPG, PNG or WebP; maximum 500 KB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
          </form>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </p>
        <button
          type="button"
          onClick={() => void loadPhotos()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Images className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-medium text-slate-700">No completion photos yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Uploaded photos will appear here once available to your account.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {signedUrls[photo.id] ? (
                <img
                  src={signedUrls[photo.id]}
                  alt={photo.description || `Completion photo for ${photo.project_name}`}
                  loading="lazy"
                  className="h-56 w-full bg-slate-100 object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center bg-slate-100 text-sm text-slate-500">
                  Image preview unavailable
                </div>
              )}

              <div className="space-y-3 p-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{photo.project_name}</h3>
                  {photo.description && (
                    <p className="mt-1 text-sm text-slate-600">{photo.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(photo.created_at).toLocaleDateString()} ·{' '}
                    {(photo.file_size_bytes / 1024).toFixed(0)} KB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void downloadPhoto(photo)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download photo
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
