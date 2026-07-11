import { useRef, useState } from 'react';
import { FileText, X, Upload, Loader2, AlertCircle, Shield, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface DocumentContext {
  filename: string;
  extractedText: string;
  charCount: number;
  wordCount: number;
  size: number;
}

interface DocumentUploaderProps {
  documents: DocumentContext[];
  onChange: (docs: DocumentContext[]) => void;
  isPro: boolean;
  onUpgrade: () => void;
}

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xls', '.xlsx'];
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUploader({ documents, onChange, isPro, onUpgrade }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]); // filenames currently uploading
  const [errors, setErrors] = useState<Record<string, string>>({}); // filename → error

  if (!isPro) {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.1)' }}
        >
          <Lock className="w-4 h-4" style={{ color: '#b45309' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Document context is a Pro feature</p>
          <p className="text-xs text-slate-500 mt-0.5">Upload PDFs, DOCX, or Excel files to ground agent analysis in your actual data.</p>
        </div>
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
        >
          Upgrade
        </button>
      </div>
    );
  }

  async function processFile(file: File) {
    // Client-side validation
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const validType = ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
    if (!validType) {
      setErrors(prev => ({ ...prev, [file.name]: 'Only PDF, DOCX, XLS, and XLSX files are supported.' }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, [file.name]: 'File exceeds 10 MB limit.' }));
      return;
    }
    if (documents.length >= MAX_FILES) {
      setErrors(prev => ({ ...prev, [file.name]: `Maximum ${MAX_FILES} files per session.` }));
      return;
    }
    if (documents.some(d => d.filename === file.name)) {
      setErrors(prev => ({ ...prev, [file.name]: 'A file with this name is already added.' }));
      return;
    }

    setErrors(prev => { const n = { ...prev }; delete n[file.name]; return n; });
    setUploading(prev => [...prev, file.name]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setErrors(prev => ({ ...prev, [file.name]: json.error || 'Extraction failed. Try saving as PDF from Word.' }));
        return;
      }

      onChange([...documents, { ...json, size: file.size }]);
    } catch {
      setErrors(prev => ({ ...prev, [file.name]: 'Upload failed — check your connection and try again.' }));
    } finally {
      setUploading(prev => prev.filter(n => n !== file.name));
    }
  }

  function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      processFile(file);
    }
  }

  function removeDocument(filename: string) {
    onChange(documents.filter(d => d.filename !== filename));
    setErrors(prev => { const n = { ...prev }; delete n[filename]; return n; });
  }

  const isAtLimit = documents.length >= MAX_FILES;
  const isUploadingAny = uploading.length > 0;
  const errorEntries = Object.entries(errors);

  return (
    <div className="space-y-2">
      {/* Uploaded files */}
      {documents.map(doc => (
        <div
          key={doc.filename}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.12)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(37,99,235,0.1)' }}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{doc.filename}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(doc.size)} · {doc.wordCount.toLocaleString()} words
            </p>
          </div>
          <button
            onClick={() => removeDocument(doc.filename)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Uploading indicators */}
      {uploading.map(name => (
        <div
          key={name}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
          <p className="text-xs text-slate-500 truncate flex-1">Extracting {name}…</p>
        </div>
      ))}

      {/* Per-file errors */}
      {errorEntries.map(([name, msg]) => (
        <div
          key={name}
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 truncate">{name}</p>
            <p className="text-xs text-red-600 mt-0.5">{msg}</p>
          </div>
          <button
            onClick={() => setErrors(prev => { const n = { ...prev }; delete n[name]; return n; })}
            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Drop zone */}
      {!isAtLimit && !isUploadingAny && (
        <div
          onDragEnter={e => { e.preventDefault(); setDragging(true); }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all"
          style={{
            background: dragging ? 'rgba(37,99,235,0.07)' : 'rgba(15,23,42,0.02)',
            border: `1.5px dashed ${dragging ? 'rgba(37,99,235,0.4)' : 'rgba(15,23,42,0.15)'}`,
          }}
        >
          <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-600">
              {documents.length === 0 ? 'Upload document context' : 'Add another document'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              PDF, DOCX, XLS, XLSX · max 10 MB · {MAX_FILES - documents.length} slot{MAX_FILES - documents.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.xls,.xlsx"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Privacy note */}
      {documents.length > 0 && (
        <div className="flex items-center gap-1.5 px-1">
          <Shield className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">Documents are used for this session only and are not stored.</p>
        </div>
      )}
    </div>
  );
}
