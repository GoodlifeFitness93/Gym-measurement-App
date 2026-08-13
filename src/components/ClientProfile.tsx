import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Client, Measurement, ProgressPhoto, ActiveScreen } from '../types';

interface Props {
  client: Client;
  onNavigate: (screen: ActiveScreen) => void;
  onRefreshClient?: () => void;
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

  // Photo Upload Modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoTag, setPhotoTag] = useState<string>('Anterior (Front)');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Compare slider state
  const [sliderVal, setSliderVal] = useState<number>(50);

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
        .order('created_at', { ascending: true });

      if (pErr) throw pErr;

      // Generate signed URLs for private storage bucket progress-photos
      const photosWithUrls: ProgressPhoto[] = await Promise.all(
        (pData || []).map(async (photo: any) => {
          let signedUrl = photo.photo_url || null;
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
    } catch (err: any) {
      console.error('Error loading client profile data:', err);
      setError(err.message || 'Failed to load client details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    : 'Oct 12, 2023';

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select an image file to upload.');
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

      const timestamp = Date.now();
      const sanitizedTag = photoTag.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/${client.id}/${timestamp}-${sanitizedTag}.${fileExt}`;

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
        tag: photoTag,
        taken_at: new Date().toISOString(),
      });

      if (dbErr) throw dbErr;

      setShowPhotoModal(false);
      setSelectedFile(null);
      await fetchData();
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload progress photo.');
    } finally {
      setUploading(false);
    }
  };

  // Photo Download Handler
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
      a.download = `${client.name.replace(/\s+/g, '_')}_${photo.tag}_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download image file directly.');
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
      client.goal_notes = notesText;
      setNotesSuccess(true);
      if (onRefreshClient) onRefreshClient();
      setTimeout(() => setNotesSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto space-y-6 pb-28 font-['Inter',sans-serif]">
      {/* Profile Header Card */}
      <section className="bg-white rounded-xl p-4 border border-[#bdc9c6]/60 shadow-[0_4px_12px_rgba(15,118,110,0.05)] flex items-center gap-4">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shrink-0 border-2 border-[#0f766e] bg-[#d8e3fb] flex items-center justify-center font-bold text-xl text-[#005c55]">
          {client.avatar_url ? (
            <img
              src={client.avatar_url}
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
              <span>{client.phone || '+1 (555) 019-2834'}</span>
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

            {/* Interactive SVG Trend Chart */}
            <div className="h-52 w-full relative flex items-end pt-4">
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[#3e4947] text-[11px] font-semibold opacity-70 pb-6 pr-2">
                <span>74</span>
                <span>71</span>
                <span>68</span>
              </div>

              <div className="ml-8 w-full h-full relative border-b border-[#bdc9c6]/50 flex items-end">
                {/* Area Gradient Background */}
                <div
                  className="absolute bottom-0 left-0 w-full h-full"
                  style={{
                    background: 'linear-gradient(to top, rgba(15, 118, 110, 0.12) 0%, rgba(15, 118, 110, 0) 100%)',
                    clipPath: 'polygon(0% 100%, 0% 80%, 25% 70%, 50% 60%, 75% 40%, 100% 20%, 100% 100%)',
                  }}
                />

                <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polyline
                    fill="none"
                    points="0,80 25,70 50,60 75,40 100,20"
                    stroke="#005c55"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Data Points */}
                <div className="absolute left-[0%] bottom-[20%] w-2.5 h-2.5 bg-white border-2 border-[#005c55] rounded-full -translate-x-1/2 translate-y-1/2" />
                <div className="absolute left-[25%] bottom-[30%] w-2.5 h-2.5 bg-white border-2 border-[#005c55] rounded-full -translate-x-1/2 translate-y-1/2" />
                <div className="absolute left-[50%] bottom-[40%] w-2.5 h-2.5 bg-white border-2 border-[#005c55] rounded-full -translate-x-1/2 translate-y-1/2" />
                <div className="absolute left-[75%] bottom-[60%] w-2.5 h-2.5 bg-white border-2 border-[#005c55] rounded-full -translate-x-1/2 translate-y-1/2" />
                <div className="absolute left-[100%] bottom-[80%] w-3.5 h-3.5 bg-[#005c55] border-2 border-white rounded-full -translate-x-1/2 translate-y-1/2 shadow" />
              </div>

              <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[#3e4947] text-[11px] font-semibold opacity-70 translate-y-full pt-2">
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
                <span>Jan</span>
                <span>Feb</span>
              </div>
            </div>
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
                const dateStr = m.measured_at || m.date || m.created_at;
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
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-[#111c2d]">Progress Photos</h3>
              <p className="text-xs text-[#3e4947]">Review visual trajectory & compare baseline</p>
            </div>
            <button
              onClick={() => setShowPhotoModal(true)}
              className="bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm btn-press"
            >
              <span className="material-symbols-outlined text-base">add_a_photo</span>
              Add Photos
            </button>
          </div>

          {/* Visual Analysis / Compare Slider Component matching screenshot 5 */}
          {photos.length >= 2 && (
            <div className="bg-white rounded-xl border border-[#bdc9c6]/60 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#bdc9c6]/40">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005c55]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    compare
                  </span>
                  <h4 className="font-semibold text-base text-[#111c2d]">Visual Analysis</h4>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="bg-[#e7eeff] text-[#3e4947] px-2 py-1 rounded">Baseline</span>
                  <span className="bg-[#86f2e4] text-[#006f66] px-2 py-1 rounded">Current</span>
                </div>
              </div>

              {/* Slider Area */}
              <div className="relative w-full max-w-[500px] mx-auto h-[350px] bg-[#f0f3ff] rounded-lg overflow-hidden border border-[#bdc9c6] select-none touch-none">
                {/* Current Photo (Bottom Layer) */}
                <img
                  src={photos[photos.length - 1].signed_url || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80'}
                  alt="Current Photo"
                  className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                />

                {/* Baseline Photo (Clipped Top Layer) */}
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-[#005c55] pointer-events-none bg-[#f0f3ff]"
                  style={{ width: `${sliderVal}%` }}
                >
                  <img
                    src={photos[0].signed_url || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80'}
                    alt="Baseline Photo"
                    className="absolute inset-0 w-[500px] h-full object-cover object-top max-w-none"
                  />
                </div>

                {/* Range Input for dragging */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderVal}
                  onChange={(e) => setSliderVal(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-ew-resize z-20 w-full h-full m-0"
                />

                {/* Slider Handle Visual */}
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
                Drag slider to compare baseline and current progress.
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
                  Upload front, side, and back photos to track physical transformations.
                </p>
                <button
                  onClick={() => setShowPhotoModal(true)}
                  className="bg-[#005c55] text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-lg"
                >
                  Upload First Photo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, idx) => {
                  const dateFormatted = photo.taken_at || photo.created_at
                    ? new Date(photo.taken_at || photo.created_at!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent';

                  return (
                    <div
                      key={photo.id || idx}
                      className="relative group bg-white rounded-lg overflow-hidden border border-[#bdc9c6]/60 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="aspect-[3/4] relative bg-[#d8e3fb]">
                        {photo.signed_url ? (
                          <img
                            src={photo.signed_url}
                            alt={photo.tag}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#3e4947] text-xs">
                            Image Unavailable
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      </div>

                      {/* Download Button Overlay */}
                      <button
                        onClick={() => handleDownloadPhoto(photo)}
                        title="Download Photo"
                        className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                      </button>

                      <div className="absolute bottom-0 left-0 w-full p-2.5 flex flex-col gap-0.5 text-white">
                        <span className="text-[10px] font-semibold bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded w-max">
                          {dateFormatted}
                        </span>
                        <span className="text-xs font-bold drop-shadow">
                          {photo.tag}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#bdc9c6]">
            <div className="flex justify-between items-center pb-2 border-b border-[#bdc9c6]/40">
              <h3 className="text-lg font-bold text-[#005c55]">Upload Progress Photo</h3>
              <button
                onClick={() => setShowPhotoModal(false)}
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
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
                  Angle Tag
                </label>
                <select
                  value={photoTag}
                  onChange={(e) => setPhotoTag(e.target.value)}
                  className="w-full p-2.5 bg-[#f0f3ff] border border-[#bdc9c6] rounded-lg text-sm text-[#111c2d]"
                >
                  <option value="Anterior (Front)">Anterior (Front)</option>
                  <option value="Lateral (Side)">Lateral (Side)</option>
                  <option value="Posterior (Back)">Posterior (Back)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3e4947] mb-1">
                  Select Image File
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#3e4947] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#e7eeff] file:text-[#005c55] hover:file:bg-[#dee8ff]"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
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
