import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

type EvidenceFile = { id: string; original_name: string; mime_type: string; size_bytes: number; storage_path: string; uploaded_at: string };
const ALLOWED = ['application/pdf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg'];
const EXT: Record<string,string> = {'application/pdf':'pdf','text/csv':'csv','application/vnd.ms-excel':'xls','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','image/png':'png','image/jpeg':'jpg'};

// The server must independently validate file bytes, hash, and size before high-trust use.
async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export default function DecisionEvidenceAttachments({ workspaceId, claimId, onEvidenceChanged }: { workspaceId: string; claimId: string; onEvidenceChanged?: () => void }) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<string>('Ready to attach evidence');

  const refresh = useCallback(async () => {
    const { data: links, error: linkError } = await supabase.from('decision_claim_evidence')
      .select('evidence_file_id').eq('claim_id', claimId);
    if (linkError) { setError(linkError.message); return; }
    const ids = (links ?? []).map(x => x.evidence_file_id);
    if (!ids.length) { setFiles([]); return; }
    const { data, error: fileError } = await supabase.from('decision_evidence_files')
      .select('id,original_name,mime_type,size_bytes,storage_path,uploaded_at').in('id', ids).order('uploaded_at', { ascending: false });
    if (fileError) { setError(fileError.message); return; }
    setFiles(data ?? []);
  }, [claimId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(chosenFiles: File[]) {
    if (!chosenFiles.length) return;
    setUploading(true); setError(null); setNotice(null);
    setStage(`Selected ${chosenFiles.length} file(s)`);
    let currentStage = 'Starting upload';
    try {
      currentStage = 'Checking sign-in'; setStage(currentStage);
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Sign in before uploading evidence.');
      for (const file of chosenFiles) {
        currentStage = `Validating ${file.name}`; setStage(currentStage);
        if (!ALLOWED.includes(file.type)) throw new Error(`Unsupported file type: ${file.name}`);
        if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error(`File must be between 1 byte and 10 MB: ${file.name}`);
        currentStage = `Calculating fingerprint for ${file.name}`; setStage(currentStage);
        const digest = await sha256Hex(file);
        const path = `${workspaceId}/${auth.user.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
        currentStage = `Uploading ${file.name} to private Storage`; setStage(currentStage);
        const { error: uploadError } = await supabase.storage.from('decision-evidence').upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        currentStage = `Registering ${file.name}`; setStage(currentStage);
        const { data: evidenceId, error: registerError } = await supabase.rpc('register_decision_evidence_file', {
          p_workspace_id: workspaceId, p_storage_path: path, p_original_name: file.name,
          p_mime_type: file.type, p_size_bytes: file.size, p_sha256_hex: digest,
          p_source_reference: null,
        });
        if (registerError || !evidenceId) throw new Error(`File uploaded but could not be registered: ${registerError?.message ?? file.name}. Contact an administrator to remove the orphaned object.`);
        currentStage = `Linking ${file.name} to claim`; setStage(currentStage);
        const { error: linkError } = await supabase.rpc('link_decision_evidence_file', { p_claim_id: claimId, p_evidence_file_id: evidenceId });
        if (linkError) throw new Error(`File registered but could not be linked: ${linkError.message}. Ask a decision reviewer to link it.`);
      }
      setStage('Upload complete');
      setNotice('Evidence attached. A reviewer must still assess the source and verify the claim.');
      setPending([]);
      await refresh();
      onEvidenceChanged?.();
    } catch (e) {
      const message = `${currentStage}: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[DecisionEvidenceAttachments] Upload failed', { stage: currentStage, error: e });
      setStage('Upload failed'); setError(message);
      window.alert(`Evidence attachment failed\n\n${message}`);
    }
    finally { setUploading(false); }
  }

  async function unlinkFile(file: EvidenceFile) {
    if (!window.confirm(`Remove "${file.original_name}" from this claim? The historical record and stored file will be retained.`)) return;
    setRemovingId(file.id); setError(null);
    try {
      const { error: unlinkError } = await supabase.rpc('unlink_decision_evidence_file', {
        p_claim_id: claimId, p_evidence_file_id: file.id,
      });
      if (unlinkError) throw unlinkError;
      await refresh();
      onEvidenceChanged?.();
      setNotice('Attachment removed from this claim. Its audit history is preserved.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to remove attachment';
      setError(message); window.alert(message);
    } finally { setRemovingId(null); }
  }

  async function openFile(file: EvidenceFile) {
    setError(null);
    const { data, error: downloadError } = await supabase.storage.from('decision-evidence').download(file.storage_path);
    if (downloadError || !data) { setError(downloadError?.message ?? 'Unable to open evidence.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = file.original_name; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--app-border)' }}>
    <div className="text-xs font-bold">Supporting evidence files</div>
    <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Private files linked to this claim. Removing a linked file preserves the stored file and audit history. Uploading does not verify the claim.</p>
    <p className="text-xs" role="status" aria-live="polite">Status: {stage}</p>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={uploading} className="rounded border px-3 py-2 text-xs font-semibold" onClick={() => pickerRef.current?.click()}>Select files</button>
      <input ref={pickerRef} className="sr-only" type="file" multiple disabled={uploading} accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg" onChange={e => {
        const chosen = Array.from(e.currentTarget.files ?? []);
        setPending(prev => [...prev, ...chosen]);
        e.currentTarget.value = '';
      }} />
      <button type="button" disabled={uploading || !pending.length} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50" onClick={() => void upload(pending)}>{uploading ? 'Uploading…' : `Upload ${pending.length} file(s)`}</button>
    </div>
    {pending.map((file, i) => <div key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate">{file.name} (not uploaded)</span>
      <button type="button" disabled={uploading} className="underline disabled:opacity-50" onClick={() => setPending(prev => prev.filter((_, index) => index !== i))}>Remove</button>
    </div>)}
    {files.map(file => <div key={file.id} className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate" title={file.original_name}>{file.original_name} ({Math.ceil(file.size_bytes / 1024)} KB)</span>
      <div className="flex shrink-0 gap-3">
        <button type="button" className="underline" onClick={() => void openFile(file)}>Download</button>
        <button type="button" disabled={removingId === file.id || uploading} className="underline text-red-600 disabled:opacity-50" onClick={() => void unlinkFile(file)}>{removingId === file.id ? 'Removing…' : 'Remove from claim'}</button>
      </div>
    </div>)}
    {files.length === 0 && <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>No files attached yet.</p>}
    {notice && <p className="text-xs" role="status">{notice}</p>}
    {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
  </section>;
}
