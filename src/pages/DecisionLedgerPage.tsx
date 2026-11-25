import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';

const origins: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude / Anthropic', google: 'Gemini / Google', microsoft: 'Microsoft Copilot', internal_ai: 'Internal AI agent', human: 'Human', other: 'Other' };
const statuses: Record<string, string> = { draft: 'Draft', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' };
const field = 'w-full rounded-lg border p-3 text-sm';
const fieldStyle = { background: 'var(--app-surface)', color: 'var(--app-text-primary)', borderColor: 'var(--app-border)' };

export default function DecisionLedgerPage({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
 const { user, session } = useAuth();
 const client = useQueryClient();
 const { workspaces, loading, error, refetch } = useUserWorkspaces();
 const ids = workspaces.map(w => w.id).sort();
 const metadata = useQuery({
  queryKey: ['user', user?.id, 'decision-ledger', ids], enabled: !!user && !loading && !error,
  queryFn: async () => {
   const result: Record<string, { origin: string | null; model: string | null; status: string }> = {};
   for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const [a,b] = await Promise.all([
     supabase.from('workspaces').select('id, decision_origin, decision_origin_model').in('id', batch),
     supabase.from('decision_lifecycles').select('workspace_id, status').in('workspace_id', batch),
    ]);
    if (a.error) throw a.error; if (b.error) throw b.error;
    for (const row of a.data || []) result[row.id] = { origin: row.decision_origin, model: row.decision_origin_model, status: 'draft' };
    for (const row of b.data || []) if (result[row.workspace_id]) result[row.workspace_id].status = row.status;
   }
   return result;
  },
 });
 const [organizationId,setOrganizationId] = useState('');
 const organizations = useQuery({
  queryKey: ['user', user?.id, 'decision-registration-organizations'], enabled: !!user,
  queryFn: async () => {
   const { data, error } = await supabase.from('organizations').select('id, name').order('name');
   if (error) throw error;
   return data || [];
  },
 });
 const [search,setSearch] = useState(''); const [filter,setFilter] = useState('all');
 const [show,setShow] = useState(false); const [title,setTitle] = useState('');
 const [origin,setOrigin] = useState('openai'); const [model,setModel] = useState('');
 const [sourceSystem,setSourceSystem]=useState(''); const [externalReference,setExternalReference]=useState(''); const [modelVersion,setModelVersion]=useState(''); const [originalAt,setOriginalAt]=useState('');
 const [description,setDescription] = useState(''); const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
 const rows = workspaces.filter(w => w.source !== 'slack' && metadata.data?.[w.id]).sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
 const visible = rows.filter(w => (filter === 'all' || metadata.data![w.id].status === filter) && `${w.name} ${w.id} ${origins[metadata.data![w.id].origin || ''] || 'Not recorded'}`.toLowerCase().includes(search.toLowerCase()));
 async function register(e: FormEvent) {
  e.preventDefault(); if (busy || !user || !session?.access_token) return;
  if (organizationId && (organizations.isError || !organizations.data?.some(o => o.id === organizationId))) { setMessage('Select an organization you belong to.'); return; }
  setBusy(true); setMessage('');
  try {
   const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-workspace`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name: title.trim(), description: description.trim(), domain: 'general', plan: 'team', organization_id: organizationId || null, decision_origin: origin, decision_origin_model: origin === 'human' ? null : model.trim() || null, decision_source_system:sourceSystem.trim() || null, decision_external_reference:externalReference.trim() || null, decision_model_version:origin==='human'?null:modelVersion.trim() || null, decision_original_at:originalAt?new Date(originalAt).toISOString():null }) });
   const data = await res.json();
   if (!res.ok || !data.workspace?.id) throw new Error(data.error || 'Registration failed. Check your workspaces before retrying.');
   await Promise.all([client.invalidateQueries({queryKey:['user',user.id,'workspaces']}),client.invalidateQueries({queryKey:['user',user.id,'own-profile-sensitive']}),client.invalidateQueries({queryKey:['user',user.id,'decision-ledger']})]);
   setShow(false); setOrganizationId(''); setTitle(''); setDescription(''); setModel(''); setSourceSystem('');setExternalReference('');setModelVersion('');setOriginalAt(''); onNavigate('decision-record', data.workspace.id);
  } catch (err) { setMessage(err instanceof Error ? err.message : 'Registration failed. Check your workspaces before retrying.'); }
  finally { setBusy(false); }
 }
 return <main className="min-h-screen p-4 sm:p-8 pb-28" style={{background:'var(--app-bg)',color:'var(--app-text-primary)'}}>
  <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div><h1 className="text-2xl font-bold">Decision Ledger</h1><p style={{color:'var(--app-text-secondary)'}}>Your accessible decisions, regardless of where they originated.</p></div><button className="rounded-lg px-4 py-3 font-semibold" style={{background:'var(--signal)',color:'var(--app-bg)'}} onClick={()=>{setShow(!show);setMessage('');}} disabled={busy}>{show?'Close registration':'+ Register external decision'}</button></div>
  {show && <form onSubmit={register} className="space-y-3 rounded-xl border p-4 mb-6" style={fieldStyle}>
   <h2 className="font-semibold">Register external decision</h2><p className="text-sm">Creates a non-public workspace using your existing plan and trial limits. Source attribution is self-reported, not verified. The recommendation is recorded in the workspace description.</p>
   <label className="block">Decision scope<select className={field} style={fieldStyle} value={organizationId} disabled={busy} onChange={e=>setOrganizationId(e.target.value)}><option value="">Private decision</option>{(organizations.data || []).map(o=><option key={o.id} value={o.id}>{o.name} — Organization</option>)}</select></label>
   {organizations.isPending && <p className="text-sm">Loading organizations…</p>}
   {organizations.isError && <p role="alert" className="text-sm">Unable to load organizations. <button type="button" className="underline" onClick={()=>void organizations.refetch()}>Retry</button></p>}
   {organizationId && <p className="text-sm">Organization governance applies. Organization owners and admins may view workspace information under existing access policies. Affiliation cannot be changed through ordinary workspace updates.</p>}
   <label className="block">Decision title<input className={field} style={fieldStyle} required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} /></label>
   <label className="block">Origin<select className={field} style={fieldStyle} value={origin} onChange={e=>setOrigin(e.target.value)}>{Object.entries(origins).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   {origin !== 'human' && <label className="block">Model or agent (optional)<input className={field} style={fieldStyle} maxLength={200} value={model} onChange={e=>setModel(e.target.value)}/></label>}
   <label className="block">Source system (optional)<input className={field} style={fieldStyle} maxLength={200} value={sourceSystem} onChange={e=>setSourceSystem(e.target.value)}/></label>
   {origin!=='human' && <label className="block">Model version (optional)<input className={field} style={fieldStyle} maxLength={200} value={modelVersion} onChange={e=>setModelVersion(e.target.value)}/></label>}
   <label className="block">External reference (optional)<input className={field} style={fieldStyle} maxLength={500} value={externalReference} onChange={e=>setExternalReference(e.target.value)}/></label>
   <label className="block">Original decision date and time (local, optional)<input type="datetime-local" className={field} style={fieldStyle} value={originalAt} onChange={e=>setOriginalAt(e.target.value)}/></label>
   <label className="block">Recommendation and rationale<textarea className={field} style={fieldStyle} rows={5} required maxLength={20000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   {message && <p role="alert" style={{color:'var(--negative)'}}>{message}</p>}
   <button type="submit" disabled={busy||!title.trim()||!description.trim()|| (!!organizationId && (organizations.isError || !organizations.data?.some(o=>o.id===organizationId)))} className="rounded-lg border px-4 py-2 disabled:opacity-50">{busy?'Registering…':'Register as draft'}</button>
  </form>}
  <div className="flex flex-wrap gap-3 mb-4"><input aria-label="Search decisions" placeholder="Search title, origin or ID" className={field+' max-w-sm'} style={fieldStyle} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Approval status" className={field+' max-w-xs'} style={fieldStyle} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All approval statuses</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button className="border rounded-lg px-3" onClick={()=>{void refetch();void metadata.refetch();}}>Refresh</button></div>
  {error || metadata.error ? <p role="alert">Unable to load the ledger. Check your connection and database migration, then refresh.</p> : loading || metadata.isPending ? <p>Loading decisions…</p> : <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">{[['Total',rows.length],['Draft',rows.filter(w=>metadata.data![w.id].status==='draft').length],['Under review',rows.filter(w=>metadata.data![w.id].status==='under_review').length],['Approved',rows.filter(w=>metadata.data![w.id].status==='approved').length]].map(([label,count])=><div key={label} className="rounded-xl border p-4" style={fieldStyle}><p className="text-sm">{label}</p><p className="text-2xl font-bold">{count}</p></div>)}</div>
  {visible.length===0?<p>No matching decisions.</p>:<div className="overflow-x-auto rounded-xl border" style={fieldStyle}><table className="w-full text-left text-sm"><thead><tr>{['Decision','Origin (reported)','Approval','Access role','Created'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{visible.map(w=>{const m=metadata.data![w.id];return <tr key={w.id} className="border-t" style={{borderColor:'var(--app-border)'}}><td className="p-3"><button className="font-semibold text-left underline" onClick={()=>onNavigate('decision-record',w.id)}>{w.name}</button><div className="text-xs break-all" style={{color:'var(--app-text-muted)'}}>{w.id}</div></td><td className="p-3">{m.origin?origins[m.origin]||m.origin:'Not recorded'}{m.model&&<div className="text-xs">{m.model}</div>}</td><td className="p-3">{statuses[m.status]||m.status}</td><td className="p-3">{w.role}</td><td className="p-3">{new Date(w.created_at).toLocaleDateString()}</td></tr>;})}</tbody></table></div>}</>}
 </main>;
}
