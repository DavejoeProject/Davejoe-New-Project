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
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  MessageSquare,
  FileCheck,
} from 'lucide-react';

const BUCKET = 'job-completion-photos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export type PhotoReviewStatus = 'pending_review' | 'approved' | 'needs_correction' | 'rejected';

export type JobCompletionPhoto = {
  id: string;
  project_name: string;
  project_id?: string | null;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by?: string | null;
  review_status?: PhotoReviewStatus;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type Props = {
  canUpload?: boolean;
};

export const JobCompletionPhotoLibrary: React.FC<Props> = ({
  canUpload = true,
}) => {
  const { user, profile, hasRole, currentRoleKey } = useAuth();
  const [photos, setPhotos] = useState<JobCompletionPhoto[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  
  // Upload form state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customProjectName, setCustomProjectName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Leadership Review Modal State
  const [reviewingPhoto, setReviewingPhoto] = useState<JobCompletionPhoto | null>(null);
  const [reviewStatusChoice, setReviewStatusChoice] = useState<PhotoReviewStatus>('approved');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | PhotoReviewStatus>('all');

  const isLeadership =
    currentRoleKey === 'management' ||
    currentRoleKey === 'executive_director' ||
    hasRole('management') ||
    hasRole('executive_director');

  // Load Projects for dropdown selection
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await supabase.from('projects').select('id, name').order('name');
        if (data) setProjects(data);
      } catch (err) {
        console.warn('[JobCompletionPhotoLibrary] Could not fetch projects list:', err);
      }
    }
    void loadProjects();
  }, []);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('job_completion_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) {
        // If table is still initializing, don't crash
        if (queryError.code === '42P01') {
          setPhotos([]);
          return;
        }
        throw queryError;
      }

      const records = (data ?? []) as JobCompletionPhoto[];
      const urlEntries = await Promise.all(
        records.map(async (photo) => {
          if (photo.storage_path.startsWith('data:') || photo.storage_path.startsWith('http')) {
            return [photo.id, photo.storage_path] as const;
          }
          const { data: urlData, error: urlError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(photo.storage_path, 600);

          if (urlError || !urlData?.signedUrl) {
            return [photo.id, ''] as const;
          }

          return [photo.id, urlData.signedUrl] as const;
        }),
      );

      setPhotos(records);
      setSignedUrls(Object.fromEntries(urlEntries));
    } catch (err: any) {
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

    if (!user) {
      setError('You must be signed in to upload photos.');
      return;
    }

    let finalProjectName = customProjectName.trim();
    let finalProjectId: string | null = null;

    if (selectedProjectId) {
      const matched = projects.find((p) => p.id === selectedProjectId);
      if (matched) {
        finalProjectName = matched.name;
        finalProjectId = matched.id;
      }
    }

    if (!finalProjectName) {
      setError('Please select an active project or enter a project/site name.');
      return;
    }

    if (!selectedFile) {
      setError('Choose a photo to upload.');
      return;
    }

    if (selectedFile.size <= 0 || selectedFile.size > MAX_FILE_SIZE) {
      setError('The photo must be no larger than 2 MB.');
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

      const storagePath = `${user.id}/${Date.now()}-${safeName}`;

      // Upload to storage bucket
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      let finalPath = storagePath;
      if (storageError) {
        console.warn('[JobCompletionPhotoLibrary] Storage upload fallback notice:', storageError.message);
        // Resilient fallback: read as data URL if storage bucket is not provisioned
        const reader = new FileReader();
        const dataUrlPromise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(selectedFile);
        finalPath = await dataUrlPromise;
      }

      // Insert record
      const { error: insertError } = await supabase
        .from('job_completion_photos')
        .insert({
          project_name: finalProjectName,
          project_id: finalProjectId,
          description: description.trim() || null,
          storage_path: finalPath,
          file_name: selectedFile.name,
          mime_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
          uploaded_by: user.id,
          review_status: 'pending_review',
        });

      if (insertError) throw insertError;

      setSelectedProjectId('');
      setCustomProjectName('');
      setDescription('');
      setSelectedFile(null);
      setNotice('Job completion photograph uploaded successfully and queued for review.');
      await loadPhotos();
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo. Please verify details.');
    } finally {
      setUploading(false);
    }
  };

  // Safe file download adhering to iframe runtime without window.open
  const handleDownloadPhoto = (photo: JobCompletionPhoto) => {
    const url = signedUrls[photo.id] || photo.storage_path;
    if (!url) {
      setError('Download link is not available yet.');
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name || `job-completion-${photo.project_name}.jpg`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err?.message || 'Unable to download this photo.');
    }
  };

  // Leadership Vetting / Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingPhoto || !user) return;

    setIsSubmittingReview(true);
    try {
      const { error: reviewError } = await supabase
        .from('job_completion_photos')
        .update({
          review_status: reviewStatusChoice,
          review_notes: reviewNotes.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewingPhoto.id);

      if (reviewError) throw reviewError;

      setReviewingPhoto(null);
      setReviewNotes('');
      setNotice(`Photo review updated: status is now "${reviewStatusChoice.replace('_', ' ').toUpperCase()}".`);
      await loadPhotos();
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save review decision.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status?: PhotoReviewStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#01875F] border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case 'needs_correction':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" />
            Needs Correction
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
    }
  };

  const filteredPhotos = photos.filter((p) => {
    if (statusFilter === 'all') return true;
    return (p.review_status || 'pending_review') === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Upload and Information Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#01875F]/10 p-3 text-[#01875F]">
              <Images className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base tracking-tight">
                Job Completion &amp; Site Evidence Library
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Verified photographic evidence for completed tasks, quality checkpoints, and social media showcase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPhotos()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#01875F]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Upload Form */}
        {canUpload && (
          <form onSubmit={handleUpload} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-[#01875F]" />
                Submit Job Completion Photograph
              </h3>
              <span className="text-[11px] text-slate-400">
                Max 2 MB (JPG, PNG, WebP)
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Associate with Project / Site *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    if (e.target.value) setCustomProjectName('');
                  }}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#01875F]"
                >
                  <option value="">-- Select from Active Projects or Type Below --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or Custom Project / Location Name
                </label>
                <input
                  type="text"
                  value={customProjectName}
                  onChange={(e) => {
                    setCustomProjectName(e.target.value);
                    if (e.target.value) setSelectedProjectId('');
                  }}
                  disabled={Boolean(selectedProjectId)}
                  placeholder="e.g. Lekki Phase 1 Residential Renovation"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#01875F] disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caption &amp; Completion Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the milestone, completed finishing trade, snagging resolution, or marketing caption..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#01875F]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Choose Image File *
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#01875F]/10 file:text-[#01875F] hover:file:bg-[#01875F]/20 cursor-pointer"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading Photo...' : 'Submit Evidence'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Alert Notices */}
      {error && (
        <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#01875F] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter and Count Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold mr-1">Filter by status:</span>
          {(['all', 'pending_review', 'approved', 'needs_correction', 'rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'all' ? 'All Photos' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <p className="text-slate-500 font-medium">
          Showing {filteredPhotos.length} of {photos.length} photos
        </p>
      </div>

      {/* Photo Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          <div className="w-8 h-8 border-2 border-[#01875F]/30 border-t-[#01875F] rounded-full animate-spin mx-auto mb-2" />
          Loading photo library...
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Images className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700 text-sm">No photographs found</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? `No job completion photographs with status "${statusFilter}".`
              : 'Uploaded job completion photographs will appear here once submitted.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPhotos.map((photo) => {
            const previewUrl = signedUrls[photo.id] || photo.storage_path;
            return (
              <article
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div>
                  <div className="relative h-52 w-full bg-slate-100 overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={photo.description || `Completion photo for ${photo.project_name}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        Preview unavailable
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      {getStatusBadge(photo.review_status)}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#01875F]">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{photo.project_name}</span>
                    </div>

                    {photo.description && (
                      <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
                        {photo.description}
                      </p>
                    )}

                    {photo.review_notes && (
                      <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                        <span className="font-bold block flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-amber-600" />
                          Reviewer Feedback:
                        </span>
                        <p>{photo.review_notes}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{new Date(photo.created_at).toLocaleDateString()}</span>
                      <span>{(photo.file_size_bytes / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-slate-50 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPhoto(photo)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>

                  {isLeadership && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingPhoto(photo);
                        setReviewStatusChoice(photo.review_status || 'approved');
                        setReviewNotes(photo.review_notes || '');
                      }}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      <span>Vet</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Leadership Vetting Modal */}
      {reviewingPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Leadership Evidence Vetting
                </h3>
                <p className="text-xs text-slate-500">
                  {reviewingPhoto.project_name} &bull; {reviewingPhoto.file_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingPhoto(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Vetting Decision *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('approved')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-colors ${
                      reviewStatusChoice === 'approved'
                        ? 'bg-emerald-50 border-emerald-500 text-[#01875F] ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('needs_correction')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-colors ${
                      reviewStatusChoice === 'needs_correction'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Need Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatusChoice('rejected')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-colors ${
                      reviewStatusChoice === 'rejected'
                        ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reviewer Feedback / Correction Request
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Specify feedback or required corrections for the submitter..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#01875F]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingPhoto(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-5 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl font-bold shadow-2xs disabled:opacity-60"
                >
                  {isSubmittingReview ? 'Saving...' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
