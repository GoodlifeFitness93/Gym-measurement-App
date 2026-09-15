import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ProgressPhoto, PhotoAngle, ActiveScreen } from '../types';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  onRefreshClient?: () => void;
}

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Front',
  back: 'Back',
  right_side: 'Right Side',
  left_side: 'Left Side',
  side: 'Side (Legacy)',
};

const UPLOAD_ANGLES: PhotoAngle[] = ['front', 'back', 'right_side', 'left_side'];

const KOLKATA_DATE = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const KOLKATA_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const KOLKATA_ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const KOLKATA_HHMM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateIN(iso: string): string {
  return KOLKATA_DATE.format(new Date(iso));
}

function formatTimeIN(iso: string): string {
  return KOLKATA_TIME.format(new Date(iso));
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const ClientProfile: React.FC<Props> = ({
  client,
  onNavigate,
  onRefreshClient,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'measurements' | 'photos' | 'notes'>('overview');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Photo Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAngle, setPendingAngle] = useState<PhotoAngle | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoDateTime, setPhotoDateTime] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Before / After compare state
  const [beforePhotoId, setBeforePhotoId] = useState<string>('');
  const [afterPhotoId, setAfterPhotoId] = useState<string>('');
  const [sliderVal, setSliderVal] = useState<number>(50);

  // Download all state
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadFailures, setDownloadFailures] = useState<string[]>([]);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Notes state
  const [notesText, setNotesText] = useState<string>(client.goal_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase client not initialized');
      setLoading(false);
      return;
    }

    try {
      // Fetch Measurements
      const { data: mData, error: mErr } = await supabase
        .from('measurements')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;
      setMeasurements(mData || []);

      // Fetch Progress Photos
      const { data: pData, error: pErr } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('client_id', client.id)
        .order('taken_at', { ascending: true });

      if (pErr) throw pErr;

      // Generate signed URLs for private storage bucket progress-photos
      const photosWithUrls: ProgressPhoto[] = await Promise.all(
        (pData || []).map(async (photo: any) => {
          let signedUrl: string | null = null;
          if (photo.storage_path) {
            const { data: sData } = await supabase.storage
              .from('progress-photos')
              .createSignedUrl(photo.storage_path, 3600);

            if (sData?.signedUrl) {
              signedUrl = sData.signedUrl;
            }
          }
          return {
            ...photo,
            signed_url: signedUrl,
          };
        })
      );

      setPhotos(photosWithUrls);
      if (photosWithUrls.length > 0) {
        // "Before" keeps the trainer's existing choice (or defaults to the earliest photo once).
        // "After" always tracks the most recently taken photo so new uploads show up automatically.
        setBeforePhotoId((prev) => prev || photosWithUrls[0].id || '');
        setAfterPhotoId(photosWithUrls[photosWithUrls.length - 1].id || '');
      }
    } catch (err: any) {
      console.error('Error loading client profile data:', err);
      setError(err.message || 'Failed to load client details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Compute key stats
  const startWeight = measurements.length > 0 && measurements[0].weight !== null
    ? measurements[0].weight
    : client.starting_weight ?? null;

  const currentWeight = measurements.length > 0 && measurements[measurements.length - 1].weight !== null
    ? measurements[measurements.length - 1].weight
    : startWeight;

  const weightChange = currentWeight !== null && startWeight !== null
    ? parseFloat((currentWeight - startWeight).toFixed(1))
    : null;

  const startedDateFormatted = client.created_at
    ? new Date(client.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  // Real, data-driven weight trend chart (replaces the previous hardcoded polyline)
  const weightChartPoints = useMemo(() => {
    const withWeight = measurements.filter((m) => m.weight !== null && m.weight !== undefined);
    if (withWeight.length < 2) return null;

    const values = withWeight.map((m) => m.weight as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return withWeight.map((m, idx) => {
      const x = (idx / (withWeight.length - 1)) * 100;
      const y = 100 - ((m.weight as number) - min) / range * 100;
      return { x, y, value: m.weight as number };
    });
  }, [measurements]);

  // Photo Upload Handlers
  const openPicker = (angle: PhotoAngle) => {
    setPendingAngle(angle);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setPhotoDateTime(toDatetimeLocalValue(new Date()));
    }
    e.target.value = '';
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setPendingAngle(null);
    setUploadError(null);
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !pendingAngle) {
      setUploadError('Please select an image file to upload.');
      return;
    }
    if (!photoDateTime) {
      setUploadError('Please choose the date and time this photo was taken.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setUploadError('Supabase client not initialized');
      setUploading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const takenAtIso = new Date(photoDateTime).toISOString();
      const takenOnDate = KOLKATA_ISO_DATE.format(new Date(takenAtIso));
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/${client.id}/${timestamp}-${pendingAngle}.${fileExt}`;

      // Upload file to progress-photos bucket
      const { error: storageErr } = await supabase.storage
        .from('progress-photos')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (storageErr) throw storageErr;

      // Insert record in progress_photos table
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        client_id: client.id,
        trainer_id: user.id,
        storage_path: storagePath,
        angle: pendingAngle,
        taken_on: takenOnDate,
        taken_at: takenAtIso,
      });

      if (dbErr) throw dbErr;

      cancelUpload();
      await fetchData();
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload progress photo.');
    } finally {
      setUploading(false);
    }
  };

  // Single Photo Download Handler
  const handleDownloadPhoto = async (photo: ProgressPhoto) => {
    try {
      if (!photo.signed_url) {
        alert('Photo signed URL is unavailable.');
        return;
      }
      const res = await fetch(photo.signed_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = photo.storage_path.split('.').pop() || 'jpg';
      a.download = `${client.name.replace(/\s+/g, '_')}_${ANGLE_LABELS[photo.angle].replace(/\s+/g, '_')}_${timestampTag(photo)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download image file directly.');
    }
  };

  function timestampTag(photo: ProgressPhoto): string {
    const iso = photo.taken_at || photo.taken_on || photo.created_at || new Date().toISOString();
    return `${KOLKATA_ISO_DATE.format(new Date(iso))}_${KOLKATA_HHMM.format(new Date(iso)).replace(':', '')}`;
  }

  // Download All Photos as ZIP, organized Client/Date/Angle_Time.ext
  const handleDownloadAll = async () => {
    if (photos.length === 0) return;
    setDownloadingAll(true);
    setDownloadFailures([]);
    setDownloadNotice(null);

    const zip = new JSZip();
    const failures: string[] = [];
    const clientFolder = client.name.replace(/\s+/g, '_');

    await Promise.all(
      photos.map(async (photo) => {
        const iso = photo.taken_at || photo.taken_on || photo.created_at || new Date().toISOString();
        const dateFolder = KOLKATA_ISO_DATE.format(new Date(iso));
        const angleLabel = ANGLE_LABELS[photo.angle].replace(/\s+/g, '_');
        const timeTag = KOLKATA_HHMM.format(new Date(iso)).replace(':', '');
        const ext = photo.storage_path.split('.').pop() || 'jpg';
        const label = `${angleLabel} (${dateFolder})`;

        try {
          if (!photo.signed_url) throw new Error('Signed URL unavailable');
          const res = await fetch(photo.signed_url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          zip.file(`${clientFolder}/${dateFolder}/${angleLabel}_${timeTag}.${ext}`, blob);
        } catch (err) {
          console.error('Failed to fetch photo for zip:', label, err);
          failures.push(label);
        }
      })
    );

    const succeededCount = photos.length - failures.length;

    if (succeededCount === 0) {
      setDownloadFailures(failures);
      setDownloadNotice('All photo downloads failed. Please check your connection and try again.');
      setDownloadingAll(false);
      return;
    }

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clientFolder}_Photos.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadFailures(failures);
      setDownloadNotice(
        failures.length > 0
          ? `Downloaded ${succeededCount} of ${photos.length} photos. ${failures.length} failed — try again to retry.`
          : `Downloaded all ${succeededCount} photos.`
      );
    } catch (err) {
      console.error('Zip generation failed:', err);
      setDownloadNotice('Failed to build the zip archive. Please try again.');
    } finally {
      setDownloadingAll(false);
    }
  };

  // Save Goal Notes Handler
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesSuccess(false);

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error: err } = await supabase
        .from('clients')
        .update({ goal_notes: notesText })
        .eq('id', client.id);

      if (err) throw err;
      setNotesSuccess(true);
      if (onRefreshClient) onRefreshClient();
      setTimeout(() => setNotesSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const beforePhoto = photos.find((p) => p.id === beforePhotoId) || null;
  const afterPhoto = photos.find((p) => p.id === afterPhotoId) || null;
  const anglesMismatch = !!(beforePhoto && afterPhoto && beforePhoto.angle !== afterPhoto.angle);

  const photoOptionLabel = (p: ProgressPhoto) => `${formatDateIN(p.taken_at || p.taken_on)} — ${ANGLE_LABELS[p.angle]}`;

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto space-y-6 pb-28 font-['Inter',sans-serif]">
      {/* Profile Header Card */}
      <section className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex items-center gap-4">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shrink-0 border-2 border-[#0f766e] bg-[#d8e3fb] flex items-center justify-center font-bold text-xl text-[#005c55]">
          {client.profile_photo_path ? (
            <img
              src={client.profile_photo_path}
              alt={client.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>
              {client.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-semibold text-[#111c2d] mb-1 truncate">
            {client.name}
          </h2>
          <div className="flex flex-col gap-1 text-sm text-[#3e4947]">
            <p className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>Started: {startedDateFormatted}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">phone_iphone</span>
              <span>{client.phone || '+91 98765 43210'}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Key Stats Row */}
      <section className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 md:p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-[#3e4947] mb-1 uppercase tracking-wider">
            Start Weight
          </span>
          <span className="text-lg md:text-xl font-bold text-[#111c2d]">
            {startWeight ? `${startWeight} kg` : '—'}
          </span>
        </div>

        <div className="bg-white rounded-xl p-3 md:p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-[#3e4947] mb-1 uppercase tracking-wider">
            Current
          </span>
          <span className="text-lg md:text-xl font-bold text-[#111c2d]">
            {currentWeight ? `${currentWeight} kg` : '—'}
          </span>
        </div>

        <div className="bg-[#86f2e4]/30 rounded-xl p-3 md:p-4 border border-[#006f66]/20 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-[#006f66] mb-1 uppercase tracking-wider">
            Change
          </span>
          <span className="text-lg md:text-xl font-bold text-[#006f66]">
            {weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} kg` : '0 kg'}
          </span>
        </div>
      </section>

      {/* Tab Bar */}
      <nav className="flex border-b border-[#bdc9c6]/60 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'text-[#005c55] border-b-2 border-[#005c55]'
              : 'text-[#3e4947] hover:text-[#111c2d]'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab('measurements')}
          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
            activeTab === 'measurements'
              ? 'text-[#005c55] border-b-2 border-[#005c55]'
              : 'text-[#3e4947] hover:text-[#111c2d]'
          }`}
        >
          Measurements ({measurements.length})
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
            activeTab === 'photos'
              ? 'text-[#005c55] border-b-2 border-[#005c55]'
              : 'text-[#3e4947] hover:text-[#111c2d]'
          }`}
        >
          Photos ({photos.length})
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
            activeTab === 'notes'
              ? 'text-[#005c55] border-b-2 border-[#005c55]'
              : 'text-[#3e4947] hover:text-[#111c2d]'
          }`}
        >
          Notes
        </button>
      </nav>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <section className="space-y-6">
          {/* Chart Card */}
          <div className="bg-white rounded-xl p-4 md:p-6 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-[#111c2d]">Weight Progress</h3>
              <button
                onClick={() => onNavigate('measurement_progress')}
                className="text-xs font-semibold text-[#005c55] hover:underline uppercase tracking-wider"
              >
                Detailed Chart →
              </button>
            </div>

            {weightChartPoints ? (
              <div className="h-52 w-full relative flex items-end pt-4">
                <div className="ml-2 w-full h-full relative border-b border-[#bdc9c6]/50 flex items-end">
                  <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polyline
                      fill="none"
                      points={weightChartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      stroke="#005c55"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {weightChartPoints.map((p, idx) => (
                    <div
                      key={idx}
                      className="absolute w-2.5 h-2.5 bg-white border-2 border-[#005c55] rounded-full -translate-x-1/2 translate-y-1/2"
                      style={{ left: `${p.x}%`, bottom: `${100 - p.y}%` }}
                      title={`${p.value} kg`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-32 w-full flex items-center justify-center text-center text-sm text-[#6e7977]">
                Log at least two weight measurements to see a progress chart.
              </div>
            )}
          </div>

          {/* Action Button: Share Progress Report */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => onNavigate('share_report')}
              className="bg-[#005c55] hover:bg-[#0f766e] text-white font-semibold py-3.5 px-8 rounded-full shadow-md btn-press flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <span className="material-symbols-outlined text-lg">ios_share</span>
              Share Progress Report
            </button>
          </div>
        </section>
      )}

      {/* MEASUREMENTS TAB */}
      {activeTab === 'measurements' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-[#111c2d]">Logged Measurements</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('measurement_progress')}
                className="text-xs font-semibold uppercase tracking-wider text-[#005c55] border border-[#005c55] px-3 py-1.5 rounded-lg hover:bg-[#e7eeff]"
              >
                Graph View
              </button>
              <button
                onClick={() => onNavigate('add_measurement')}
                className="text-xs font-semibold uppercase tracking-wider bg-[#005c55] text-white px-3 py-1.5 rounded-lg hover:bg-[#0f766e]"
              >
                + Add Entry
              </button>
            </div>
          </div>

          {measurements.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-[#bdc9c6]/60">
              <span className="material-symbols-outlined text-3xl text-[#005c55] mb-2">
                straighten
              </span>
              <p className="text-sm font-semibold text-[#111c2d]">No measurements recorded yet</p>
              <button
                onClick={() => onNavigate('add_measurement')}
                className="mt-3 bg-[#005c55] text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-lg"
              >
                Log First Measurement
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#bdc9c6]/60 divide-y divide-[#bdc9c6]/40 overflow-hidden shadow-sm">
              {measurements.map((m, idx) => {
                const dateStr = m.measured_on || m.created_at;
                const formattedDate = dateStr
                  ? new Date(dateStr).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : `Entry #${idx + 1}`;

                return (
                  <div key={m.id || idx} className="p-4 hover:bg-[#f0f3ff] transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-[#005c55]">{formattedDate}</span>
                      <span className="text-base font-bold text-[#111c2d]">
                        {m.weight !== null && m.weight !== undefined ? `${m.weight} kg` : '—'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#3e4947]">
                      {m.body_fat_percent !== null && (
                        <div>Body Fat: <span className="font-semibold text-[#111c2d]">{m.body_fat_percent}%</span></div>
                      )}
                      {m.chest !== null && (
                        <div>Chest: <span className="font-semibold text-[#111c2d]">{m.chest} cm</span></div>
                      )}
                      {m.waist !== null && (
                        <div>Waist: <span className="font-semibold text-[#111c2d]">{m.waist} cm</span></div>
                      )}
                      {m.hips !== null && (
                        <div>Hips: <span className="font-semibold text-[#111c2d]">{m.hips} cm</span></div>
                      )}
                      {m.neck !== null && (
                        <div>Neck: <span className="font-semibold text-[#111c2d]">{m.neck} cm</span></div>
                      )}
                      {m.arm !== null && (
                        <div>Arm: <span className="font-semibold text-[#111c2d]">{m.arm} cm</span></div>
                      )}
                      {m.thigh !== null && (
                        <div>Thigh: <span className="font-semibold text-[#111c2d]">{m.thigh} cm</span></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PHOTOS TAB */}
      {activeTab === 'photos' && (
        <section className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-semibold text-[#111c2d]">Progress Photos</h3>
              <p className="text-xs text-[#3e4947]">Review visual trajectory & compare baseline</p>
            </div>
            {photos.length > 0 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="bg-white text-[#005c55] border-2 border-[#005c55] hover:bg-[#e7eeff] text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  {downloadingAll ? 'hourglass_empty' : 'folder_zip'}
                </span>
                {downloadingAll ? 'Preparing...' : 'Download All Photos'}
              </button>
            )}
          </div>

          {downloadNotice && (
            <div
              className={`p-3 text-xs font-medium rounded-lg border ${
                downloadFailures.length > 0
                  ? 'bg-[#fff3cd] text-[#664d03] border-[#ffc107]/40'
                  : 'bg-[#86f2e4]/30 text-[#006f66] border-[#006f66]/20'
              }`}
            >
              {downloadNotice}
              {downloadFailures.length > 0 && (
                <ul className="list-disc list-inside mt-1">
                  {downloadFailures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Angle Upload Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
            {UPLOAD_ANGLES.map((angle) => (
              <button
                key={angle}
                onClick={() => openPicker(angle)}
                className="bg-white hover:bg-[#f0f3ff] border border-[#bdc9c6]/60 rounded-xl p-3 flex flex-col items-center gap-1.5 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[#005c55] text-xl">add_a_photo</span>
                <span className="text-xs font-semibold text-[#111c2d]">{ANGLE_LABELS[angle]}</span>
              </button>
            ))}
          </div>

          {/* Before / After Comparison */}
          {photos.length >= 2 && beforePhoto && afterPhoto && (
            <div className="bg-white rounded-xl border border-[#bdc9c6]/60 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#bdc9c6]/40">
                <span className="material-symbols-outlined text-[#005c55]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  compare
                </span>
                <h4 className="font-semibold text-base text-[#111c2d]">Before / After Comparison</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="before-select" className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
                    Before
                  </label>
                  <select
                    id="before-select"
                    value={beforePhotoId}
                    onChange={(e) => setBeforePhotoId(e.target.value)}
                    className="w-full p-2 bg-[#f0f3ff] border border-[#bdc9c6] rounded-lg text-sm text-[#111c2d]"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {photoOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="after-select" className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
                    After
                  </label>
                  <select
                    id="after-select"
                    value={afterPhotoId}
                    onChange={(e) => setAfterPhotoId(e.target.value)}
                    className="w-full p-2 bg-[#f0f3ff] border border-[#bdc9c6] rounded-lg text-sm text-[#111c2d]"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {photoOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {anglesMismatch && (
                <p className="text-xs text-[#664d03] bg-[#fff3cd] border border-[#ffc107]/40 rounded px-2 py-1.5 mb-3">
                  Before and After photos use different angles — the comparison may be less accurate.
                </p>
              )}

              {/* Slider Area */}
              <div className="relative w-full max-w-[500px] mx-auto h-[350px] bg-[#f0f3ff] rounded-lg overflow-hidden border border-[#bdc9c6] select-none touch-none">
                <img
                  src={afterPhoto.signed_url || ''}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                />

                <div
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-[#005c55] pointer-events-none bg-[#f0f3ff]"
                  style={{ width: `${sliderVal}%` }}
                >
                  <img
                    src={beforePhoto.signed_url || ''}
                    alt="Before"
                    className="absolute inset-0 w-[500px] h-full object-cover object-top max-w-none"
                  />
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderVal}
                  onChange={(e) => setSliderVal(Number(e.target.value))}
                  aria-label="Before/after comparison position (percent of Before photo visible)"
                  className="absolute inset-0 opacity-0 cursor-ew-resize z-20 w-full h-full m-0"
                />

                <div
                  className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center pointer-events-none z-10"
                  style={{ left: `${sliderVal}%` }}
                >
                  <div className="w-[2px] h-full bg-[#005c55] flex items-center justify-center relative">
                    <div className="w-9 h-9 bg-white border border-[#bdc9c6] rounded-full shadow-md flex items-center justify-center text-[#005c55]">
                      <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-[#3e4947] mt-2">
                Drag the slider (or use arrow keys once focused) — Before {sliderVal}% / After {100 - sliderVal}%
              </p>
            </div>
          )}

          {/* Gallery Archive Grid */}
          <div className="space-y-3">
            <h4 className="font-semibold text-[#111c2d] text-base">Gallery Archive</h4>

            {photos.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[#bdc9c6]/60">
                <span className="material-symbols-outlined text-3xl text-[#005c55] mb-2">
                  photo_library
                </span>
                <p className="text-sm font-semibold text-[#111c2d]">No progress photos uploaded yet</p>
                <p className="text-xs text-[#6e7977] mt-1 mb-3">
                  Upload front, back, and side photos to track physical transformations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    className="relative group bg-white rounded-lg overflow-hidden border border-[#bdc9c6]/60 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="aspect-[3/4] relative bg-[#d8e3fb]">
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt={ANGLE_LABELS[photo.angle]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#3e4947] text-xs">
                          Image Unavailable
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    </div>

                    <button
                      onClick={() => handleDownloadPhoto(photo)}
                      title="Download Photo"
                      className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                    </button>

                    <div className="absolute bottom-0 left-0 w-full p-2.5 flex flex-col gap-0.5 text-white">
                      <span className="text-xs font-bold uppercase drop-shadow">
                        {ANGLE_LABELS[photo.angle]}
                      </span>
                      <span className="text-[10px] font-semibold bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded w-max">
                        {formatDateIN(photo.taken_at || photo.taken_on)}
                      </span>
                      <span className="text-[10px] font-semibold bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded w-max">
                        {formatTimeIN(photo.taken_at || photo.taken_on)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <section className="bg-white rounded-xl p-4 md:p-6 border border-[#bdc9c6]/60 shadow-sm space-y-4">
          <h3 className="text-xl font-semibold text-[#111c2d]">Coaching & Goal Notes</h3>
          <p className="text-xs text-[#3e4947]">
            Keep track of personal fitness goals, medical background, dietary restrictions, or training milestones.
          </p>

          <textarea
            rows={6}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="e.g. Goal: Lose 5kg in 12 weeks. Prefers low-impact cardio. Avoid heavy squatting due to past knee sensitivity..."
            className="w-full p-3 bg-[#f0f3ff] border border-[#bdc9c6] rounded-lg text-sm text-[#111c2d] focus:outline-none focus:border-[#005c55]"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-lg btn-press shadow-sm"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
            {notesSuccess && (
              <span className="text-xs text-[#0f766e] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved successfully!
              </span>
            )}
          </div>
        </section>
      )}

      {/* UPLOAD PHOTO MODAL */}
      {selectedFile && pendingAngle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#bdc9c6]">
            <div className="flex justify-between items-center pb-2 border-b border-[#bdc9c6]/40">
              <h3 className="text-lg font-bold text-[#005c55]">Upload {ANGLE_LABELS[pendingAngle]} Photo</h3>
              <button
                onClick={cancelUpload}
                className="text-[#6e7977] hover:text-[#111c2d]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-[#ffdad6] text-[#93000a] text-xs rounded border border-[#ba1a1a]/20">
                {uploadError}
              </div>
            )}

            <form onSubmit={handlePhotoUpload} className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-[#bdc9c6] bg-[#f0f3ff] aspect-video flex items-center justify-center">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Selected preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                <label htmlFor="taken-at" className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
                  Date & Time Taken
                </label>
                <input
                  id="taken-at"
                  type="datetime-local"
                  value={photoDateTime}
                  onChange={(e) => setPhotoDateTime(e.target.value)}
                  className="w-full p-2.5 bg-[#f0f3ff] border border-[#bdc9c6] rounded-lg text-sm text-[#111c2d]"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="px-4 py-2 text-xs font-semibold uppercase text-[#3e4947] hover:bg-[#f0f3ff] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-[#005c55] text-white text-xs font-semibold uppercase tracking-wider rounded-lg btn-press shadow"
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
