import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Sparkles, Pencil } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ProgressPhoto, PhotoAngle, ActiveScreen } from '../types';
import { ClientSettingsTab } from './ClientSettingsTab';
import { AIAnalysisModal } from './AIAnalysisModal';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  onRefreshClient?: () => void;
  onEditMeasurement: (measurement: Measurement) => void;
  onAddMeasurement: () => void;
}

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Front',
  back: 'Back',
  right_side: 'Right Side',
  left_side: 'Left Side',
  side: 'Side (Legacy)',
};

const UPLOAD_ANGLES: PhotoAngle[] = ['front', 'back', 'right_side', 'left_side'];

const PERIMETER_FIELDS: { key: keyof Measurement; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hip' },
  { key: 'neck', label: 'Neck' },
  { key: 'arm', label: 'Biceps' },
  { key: 'forearm', label: 'Forearm' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'gluteus', label: 'Gluteus' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'calf', label: 'Calf' },
];

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
  onEditMeasurement,
  onAddMeasurement,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'measurements' | 'photos' | 'notes' | 'settings'>('overview');
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
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

  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  // BMI = weight(kg) / height(m)^2 — only shown when both real values are on record.
  const bmi = latestMeasurement?.weight && client.height_cm
    ? parseFloat((latestMeasurement.weight / ((client.height_cm / 100) ** 2)).toFixed(1))
    : null;
  const bmiCategory = bmi === null ? null
    : bmi < 18.5 ? 'Underweight'
    : bmi < 25 ? 'Healthy range'
    : bmi < 30 ? 'Overweight'
    : 'Obese';

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
      <section className="bg-surface rounded-xl p-4 border border-border flex items-center gap-4">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shrink-0 border-2 border-accent bg-surface-alt flex items-center justify-center font-bold text-xl text-accent">
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
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-1 truncate">
            {client.name}
          </h2>
          <div className="flex flex-col gap-1 text-sm text-text-muted">
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
        <div className="bg-surface rounded-xl p-3 md:p-4 border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-text-muted mb-1 uppercase tracking-wider">
            Start Weight
          </span>
          <span className="text-lg md:text-xl font-bold text-white">
            {startWeight ? `${startWeight} kg` : '—'}
          </span>
        </div>

        <div className="bg-surface rounded-xl p-3 md:p-4 border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-text-muted mb-1 uppercase tracking-wider">
            Current
          </span>
          <span className="text-lg md:text-xl font-bold text-white">
            {currentWeight ? `${currentWeight} kg` : '—'}
          </span>
        </div>

        <div className="bg-accent/10 rounded-xl p-3 md:p-4 border border-accent/20 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold text-accent mb-1 uppercase tracking-wider">
            Change
          </span>
          <span className="text-lg md:text-xl font-bold text-accent">
            {weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} kg` : '0 kg'}
          </span>
        </div>
      </section>

      {/* Tab Bar */}
      <nav className="flex border-b border-border overflow-x-auto no-scrollbar">
        {(['overview', 'measurements', 'photos', 'notes', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors capitalize ${
              activeTab === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-white'
            }`}
          >
            {tab === 'measurements' ? `Measurements (${measurements.length})` : tab === 'photos' ? `Photos (${photos.length})` : tab}
          </button>
        ))}
      </nav>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <section className="space-y-6">
          {/* Last Measurement */}
          <div className="bg-surface rounded-xl p-4 md:p-6 border border-border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Last Measurement</span>
                <p className="text-white font-semibold">
                  {latestMeasurement
                    ? new Date(latestMeasurement.measured_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No measurements yet.'}
                </p>
              </div>
              {measurements.length > 0 && (
                <button
                  onClick={() => setActiveTab('measurements')}
                  className="text-xs font-semibold text-accent hover:underline uppercase tracking-wider"
                >
                  See All ({measurements.length}) →
                </button>
              )}
            </div>

            {latestMeasurement && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">Weight</span>
                  <span className="text-sm font-bold text-white">{latestMeasurement.weight != null ? `${latestMeasurement.weight} kg` : '—'}</span>
                </div>
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">Fat</span>
                  <span className="text-sm font-bold text-white">{latestMeasurement.body_fat_percent != null ? `${latestMeasurement.body_fat_percent}%` : '—'}</span>
                </div>
                <div className="bg-surface-alt rounded-lg p-2.5 text-center">
                  <span className="block text-[10px] uppercase text-text-muted mb-1">BMI</span>
                  <span className="text-sm font-bold text-white">{bmi ?? '—'}</span>
                  {bmiCategory && <span className="block text-[10px] text-accent">{bmiCategory}</span>}
                </div>
              </div>
            )}

            <button
              onClick={onAddMeasurement}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg btn-press flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Measurement
            </button>
          </div>

          {/* Chart Card */}
          <div className="bg-surface rounded-xl p-4 md:p-6 border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Weight Progress</h3>
              <button
                onClick={() => onNavigate('measurement_progress')}
                className="text-xs font-semibold text-accent hover:underline uppercase tracking-wider"
              >
                Detailed Chart →
              </button>
            </div>

            {weightChartPoints ? (
              <div className="h-52 w-full relative flex items-end pt-4">
                <div className="ml-2 w-full h-full relative border-b border-border flex items-end">
                  <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polyline
                      fill="none"
                      points={weightChartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      stroke="#ff6a1a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {weightChartPoints.map((p, idx) => (
                    <div
                      key={idx}
                      className="absolute w-2.5 h-2.5 bg-surface border-2 border-accent rounded-full -translate-x-1/2 translate-y-1/2"
                      style={{ left: `${p.x}%`, bottom: `${100 - p.y}%` }}
                      title={`${p.value} kg`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-32 w-full flex items-center justify-center text-center text-sm text-text-muted">
                Log at least two weight measurements to see a progress chart.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowAiAnalysis(true)}
              className="bg-surface border border-accent text-accent hover:bg-accent/10 font-semibold py-3.5 px-8 rounded-full btn-press flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" />
              AI-Powered Analysis
            </button>
            <button
              onClick={() => onNavigate('share_report')}
              className="bg-accent hover:bg-accent-hover text-white font-semibold py-3.5 px-8 rounded-full btn-press flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-lg">ios_share</span>
              Share Progress Report
            </button>
          </div>
        </section>
      )}

      {showAiAnalysis && <AIAnalysisModal client={client} onClose={() => setShowAiAnalysis(false)} />}

      {/* MEASUREMENTS TAB */}
      {activeTab === 'measurements' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Logged Measurements</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('measurement_progress')}
                className="text-xs font-semibold uppercase tracking-wider text-accent border border-accent px-3 py-1.5 rounded-lg hover:bg-accent/10"
              >
                Graph View
              </button>
              <button
                onClick={onAddMeasurement}
                className="text-xs font-semibold uppercase tracking-wider bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent-hover"
              >
                + Add Entry
              </button>
            </div>
          </div>

          {measurements.length === 0 ? (
            <div className="bg-surface rounded-xl p-8 text-center border border-border">
              <span className="material-symbols-outlined text-3xl text-accent mb-2">
                straighten
              </span>
              <p className="text-sm font-semibold text-white">No measurements recorded yet</p>
              <button
                onClick={onAddMeasurement}
                className="mt-3 bg-accent text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-lg"
              >
                Log First Measurement
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-border divide-y divide-border overflow-hidden">
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
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => onEditMeasurement(m)}
                    className="w-full text-left p-4 hover:bg-surface-alt transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-accent">
                        {formattedDate}
                        {m.session_name && (
                          <span className="ml-2 text-[10px] font-bold uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded normal-case">
                            {m.session_name}
                          </span>
                        )}
                      </span>
                      <span className="text-base font-bold text-white flex items-center gap-1.5">
                        {m.weight !== null && m.weight !== undefined ? `${m.weight} kg` : '—'}
                        <Pencil className="w-3.5 h-3.5 text-text-muted" />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-text-muted">
                      {m.body_fat_percent !== null && m.body_fat_percent !== undefined && (
                        <div>Body Fat: <span className="font-semibold text-white">{m.body_fat_percent}%</span></div>
                      )}
                      {PERIMETER_FIELDS.map(({ key, label }) => {
                        const val = m[key];
                        if (val === null || val === undefined) return null;
                        return (
                          <div key={key}>{label}: <span className="font-semibold text-white">{val as number} cm</span></div>
                        );
                      })}
                    </div>
                  </button>
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
              <h3 className="text-xl font-semibold text-white">Progress Photos</h3>
              <p className="text-xs text-text-muted">Review visual trajectory & compare baseline</p>
            </div>
            {photos.length > 0 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="bg-surface text-accent border-2 border-accent hover:bg-accent/10 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
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
                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                  : 'bg-success/10 text-success border-success/20'
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
                className="bg-surface hover:bg-surface-alt border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-accent text-xl">add_a_photo</span>
                <span className="text-xs font-semibold text-white">{ANGLE_LABELS[angle]}</span>
              </button>
            ))}
          </div>

          {/* Before / After Comparison */}
          {photos.length >= 2 && beforePhoto && afterPhoto && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <span className="material-symbols-outlined text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                  compare
                </span>
                <h4 className="font-semibold text-base text-white">Before / After Comparison</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="before-select" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    Before
                  </label>
                  <select
                    id="before-select"
                    value={beforePhotoId}
                    onChange={(e) => setBeforePhotoId(e.target.value)}
                    className="w-full p-2 bg-surface-alt border border-border rounded-lg text-sm text-white"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {photoOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="after-select" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                    After
                  </label>
                  <select
                    id="after-select"
                    value={afterPhotoId}
                    onChange={(e) => setAfterPhotoId(e.target.value)}
                    className="w-full p-2 bg-surface-alt border border-border rounded-lg text-sm text-white"
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
                <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded px-2 py-1.5 mb-3">
                  Before and After photos use different angles — the comparison may be less accurate.
                </p>
              )}

              {/* Slider Area — both images render the COMPLETE photo (object-contain, letterboxed)
                  and the "before" image is revealed via clip-path so nothing is cropped or misaligned. */}
              <div className="relative w-full max-w-[500px] mx-auto h-[350px] bg-ink rounded-lg overflow-hidden border border-border select-none touch-none">
                <img
                  src={afterPhoto.signed_url || ''}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                <img
                  src={beforePhoto.signed_url || ''}
                  alt="Before"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - sliderVal}% 0 0)` }}
                />

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
                  <div className="w-[2px] h-full bg-accent flex items-center justify-center relative">
                    <div className="w-9 h-9 bg-surface border border-border rounded-full shadow-md flex items-center justify-center text-accent">
                      <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-text-muted mt-2">
                Drag the slider (or use arrow keys once focused) — Before {sliderVal}% / After {100 - sliderVal}%
              </p>
            </div>
          )}

          {/* Gallery Archive Grid */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-base">Gallery Archive</h4>

            {photos.length === 0 ? (
              <div className="bg-surface rounded-xl p-8 text-center border border-border">
                <span className="material-symbols-outlined text-3xl text-accent mb-2">
                  photo_library
                </span>
                <p className="text-sm font-semibold text-white">No progress photos uploaded yet</p>
                <p className="text-xs text-text-muted mt-1 mb-3">
                  Upload front, back, and side photos to track physical transformations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    className="relative group bg-surface rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all"
                  >
                    <div className="aspect-[3/4] relative bg-surface-alt">
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt={ANGLE_LABELS[photo.angle]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
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
        <section className="bg-surface rounded-xl p-4 md:p-6 border border-border space-y-4">
          <h3 className="text-xl font-semibold text-white">Coaching & Goal Notes</h3>
          <p className="text-xs text-text-muted">
            Keep track of personal fitness goals, medical background, dietary restrictions, or training milestones.
          </p>

          <textarea
            rows={6}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="e.g. Goal: Lose 5kg in 12 weeks. Prefers low-impact cardio. Avoid heavy squatting due to past knee sensitivity..."
            className="w-full p-3 bg-surface-alt border border-border rounded-lg text-sm text-white focus:outline-none focus:border-accent"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-lg btn-press"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
            {notesSuccess && (
              <span className="text-xs text-success font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved successfully!
              </span>
            )}
          </div>
        </section>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <ClientSettingsTab
          client={client}
          measurements={measurements}
          onNavigate={onNavigate}
          onRefreshClient={() => onRefreshClient && onRefreshClient()}
          onRefreshMeasurements={fetchData}
        />
      )}

      {/* UPLOAD PHOTO MODAL */}
      {selectedFile && pendingAngle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl max-w-md w-full p-6 space-y-4 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-lg font-bold text-accent">Upload {ANGLE_LABELS[pendingAngle]} Photo</h3>
              <button
                onClick={cancelUpload}
                className="text-text-muted hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-danger-bg text-danger text-xs rounded border border-danger/30">
                {uploadError}
              </div>
            )}

            <form onSubmit={handlePhotoUpload} className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-border bg-surface-alt aspect-video flex items-center justify-center">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Selected preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                <label htmlFor="taken-at" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Date & Time Taken
                </label>
                <input
                  id="taken-at"
                  type="datetime-local"
                  value={photoDateTime}
                  onChange={(e) => setPhotoDateTime(e.target.value)}
                  className="w-full p-2.5 bg-surface-alt border border-border rounded-lg text-sm text-white"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="px-4 py-2 text-xs font-semibold uppercase text-text-muted hover:bg-surface-alt rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-accent text-white text-xs font-semibold uppercase tracking-wider rounded-lg btn-press"
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
