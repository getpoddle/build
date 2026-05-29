import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Loader2, X, Upload } from 'lucide-react';
import { compressImage } from '../lib/imageCompression';

interface ProfilePictureUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  onUploadComplete: () => void;
}

export default function ProfilePictureUpload({
  userId,
  currentAvatarUrl,
  onUploadComplete,
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setPreviewUrl(URL.createObjectURL(file));
      setUploading(true);
      setShowButtons(false);

      let processedFile = file;

      if (file.size > 500 * 1024) {
        try {
          processedFile = await compressImage(file, 1, 1024);
        } catch (compressError) {
          console.warn('Compression failed, using original file:', compressError);
        }
      }

      if (processedFile.size > 5 * 1024 * 1024) {
        alert('Image is too large. Please choose a smaller image.');
        setUploading(false);
        setPreviewUrl(null);
        return;
      }

      // Delete existing avatar files first
      const existingFiles = await supabase.storage
        .from('avatars')
        .list(userId);

      if (existingFiles.data && existingFiles.data.length > 0) {
        await Promise.all(
          existingFiles.data.map((file) =>
            supabase.storage.from('avatars').remove([`${userId}/${file.name}`])
          )
        );
      }

      // Use timestamp to ensure unique filename and bust cache
      const timestamp = Date.now();
      const fileExt = 'jpg';
      const filePath = `${userId}/avatar_${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      onUploadComplete();
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload profile picture');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    try {
      setUploading(true);

      if (currentAvatarUrl && !currentAvatarUrl.startsWith('http')) {
        await supabase.storage.from('avatars').remove([currentAvatarUrl]);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      onUploadComplete();
    } catch (error) {
      console.error('Error removing avatar:', error);
      alert('Failed to remove profile picture');
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || getAvatarUrl(currentAvatarUrl);

  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 group">
      <div
        className="w-full h-full rounded-full overflow-hidden border-4 border-white cursor-pointer touch-manipulation"
        style={{ boxShadow: '0 8px 24px rgba(15,23,42,0.2)' }}
        onClick={() => {
          if (isMobile) {
            setShowButtons(!showButtons);
          }
        }}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}>
            {uploading ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Camera className="w-8 h-8 text-white/80" />
            )}
          </div>
        )}

        {!uploading && !isMobile && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-full">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="p-2.5 bg-white/90 rounded-full hover:bg-white transition-all active:scale-95"
              disabled={uploading}
              aria-label="Change profile picture"
            >
              <Camera className="w-4 h-4 text-slate-700" />
            </button>
            {currentAvatarUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                className="p-2.5 bg-red-500/90 rounded-full hover:bg-red-500 transition-all active:scale-95"
                disabled={uploading}
                aria-label="Remove profile picture"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {!uploading && isMobile && (
        <button
          onClick={() => setShowButtons(!showButtons)}
          className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center active:scale-95 transition-transform touch-manipulation z-10"
          aria-label="Photo options"
        >
          <Camera className="w-4 h-4 text-slate-700" />
        </button>
      )}

      {isMobile && showButtons && !uploading && (
        <div className="absolute top-full left-0 mt-2 flex flex-col gap-1.5 z-50 min-w-[140px]">
          <button
            onClick={() => { setShowButtons(false); cameraInputRef.current?.click(); }}
            className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl shadow-lg border border-slate-100 active:scale-95 transition-transform touch-manipulation whitespace-nowrap"
          >
            <Camera className="w-4 h-4 text-slate-700 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700">Camera</span>
          </button>
          <button
            onClick={() => { setShowButtons(false); fileInputRef.current?.click(); }}
            className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-xl shadow-lg border border-slate-100 active:scale-95 transition-transform touch-manipulation whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-slate-700 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700">Gallery</span>
          </button>
          {currentAvatarUrl && (
            <button
              onClick={() => { setShowButtons(false); handleRemove(); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-red-500 rounded-xl shadow-lg active:scale-95 transition-transform touch-manipulation whitespace-nowrap"
            >
              <X className="w-4 h-4 text-white flex-shrink-0" />
              <span className="text-sm font-medium text-white">Remove</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  );
}
