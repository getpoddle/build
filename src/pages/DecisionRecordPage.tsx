import { useState } from 'react';
import DecisionApprovalPanel from '../components/DecisionApprovalPanel';
import DecisionVersionHistory from '../components/DecisionVersionHistory';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';
import { supabase } from '../lib/supabase';
import { TimelineView } from './DecisionTrailPage';

const origins: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude / Anthropic', google: 'Gemini / Google', microsoft: 'Microsoft Copilot', internal_ai: 'Internal AI agent', human: 'Human', other: 'Other' };

function ExternalEvidenceForm({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open,setOpen] = useState(false);
  const [statement,setStatement] = useState('');
  const [kind,setKind] = useState('external_ai');
  const [name,setName] = useState('');
  const [reference,setReference] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const field = 'block w-full rounded-lg border p-2 mt-1';
  const style = {background:'var(--app-bg)',color:'var(--app-text-primary)',borderColor:'var(--app-border)'};
  return <section className="panel p-4 mb-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Evidence Register</h2><button className="btn-secondary" disabled={busy} onClick={()=>setOpen(!open)}>{open?'Close':'+ Register evidence'}</button></div>
    {open && <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy||!statement.trim())return;setBusy(true);setMessage('');try {
      const {error}=await supabase.rpc('register_external_evidence',{p_workspace_id:workspaceId,p_statement:statement.trim(),p_source_kind:kind,p_source_name:name.trim(),p_source_reference:reference.trim()});
      if(error)throw error;
      setStatement('');setName('');setReference('');setOpen(false);setMessage('Evidence registered. Expand the new evidence claim to attach supporting documents.');
      await client.invalidateQueries({queryKey:['user',user?.id,'decision-trail',workspaceId]});
    } catch(err) {setMessage(typeof err==='object'&&err&&'message' in err?String(err.message):'Registration failed. Refresh before retrying.');} finally {setBusy(false);}}}>
      <label className="block text-sm">Source category<select className={field} style={style} value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries({external_ai:'External AI output',human:'Human-provided evidence',research:'Research or publication',business_data:'Internal business data',other:'Other'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block text-sm">Evidence statement<textarea className={field} style={style} rows={4} required maxLength={10000} value={statement} onChange={e=>setStatement(e.target.value)}/></label>
      <label className="block text-sm">Source name (optional)<input className={field} style={style} maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label className="block text-sm">Source URL or reference (optional)<input className={field} style={style} maxLength={2000} value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <p className="text-xs">Evidence is initially unverified. Registration does not establish accuracy or source authenticity.</p>
      <button className="btn-secondary" type="submit" disabled={busy||!statement.trim()}>{busy?'Registering…':'Register unverified evidence'}</button>
    </form>}
    {message&&<p role="status" className="text-sm break-words">{message}</p>}
  </section>;
}

export default function DecisionRecordPage({ workspaceId, onNavigate }: { workspaceId: string | null; onNavigate: (page: string, id?: string) => void }) {
  const { user } = useAuth();
  const tabs = ['Overview', 'Evidence', 'Ownership', 'Approvals', 'Audit Trail', 'Versions'] as const;
  const [selection, setSelection] = useState<{id: string | null; tab: typeof tabs[number]}>({id: workspaceId, tab: 'Overview'});
  const tab = selection.id === workspaceId ? selection.tab : 'Overview';
  const { workspaces, loading, error } = useUserWorkspaces();
  const workspace = workspaces.find(w => w.id === workspaceId && w.source !== 'slack');
  const record = useQuery({
    queryKey: ['user', user?.id, 'decision-record', workspaceId],
    enabled: !!user && !!workspace && !loading && !error,
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces')
        .select('id, name, description, decision_origin, decision_origin_model, created_at')
        .eq('id', workspaceId!).single();
      if (error) throw error;
      return data;
    },
  });
  const lifecycle = useQuery({
    queryKey: ['user', user?.id, 'decision-record-status', workspaceId],
    enabled: !!user && !!workspace && !loading && !error,
    queryFn: async () => {
      const { data, error } = await supabase.from('decision_lifecycles').select('status, approval_cycle').eq('workspace_id', workspaceId!).maybeSingle();
      if (error) throw error;
      return data ?? { status: 'draft', approval_cycle: 0 };
    },
  });
  const back = () => onNavigate('decision-ledger');
  return <main className="min-h-screen px-4 sm:px-8 py-6 pb-28" style={{ background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}>
    {loading || (!!workspace && record.isPending && !error) ? <p>Loading decision record…</p> : error || record.error || !workspace || !record.data ? <div role="alert"><p>This decision is unavailable or access could not be verified.</p><button className="btn-secondary mt-4" onClick={back}>Back to Decision Ledger</button></div> : <>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div className="min-w-0"><button className="btn-secondary mb-3" onClick={back}>← Back to Decision Ledger</button><p className="section-label">Decision Record</p><h1 className="text-2xl font-bold break-words">{record.data.name}</h1><p className="text-sm mt-2" style={{color:'var(--app-text-secondary)'}}>Approval status: <strong>{lifecycle.isError ? 'Unavailable' : lifecycle.isPending ? 'Loading…' : ({draft:'Draft',under_review:'Under review',approved:'Approved',rejected:'Rejected'} as Record<string,string>)[lifecycle.data.status] || lifecycle.data.status}</strong></p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => onNavigate('workspace-hub', workspace.id)}>Open in War Room</button>
          {(workspace.role === 'owner' || workspace.role === 'admin') && <button className="btn-secondary" onClick={() => onNavigate('workspace-settings', workspace.id)}>Ownership & settings</button>}
        </div>
      </div>
      <nav aria-label="Decision record sections" className="flex gap-1 overflow-x-auto border-b mb-6" style={{borderColor:'var(--app-border)'}}>
        {tabs.map(item => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setSelection({id:workspaceId,tab:item})} className="whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2" style={{borderColor:tab===item?'var(--signal)':'transparent',color:tab===item?'var(--signal)':'var(--app-text-secondary)'}}>{item}</button>)}
      </nav>
      {tab === 'Overview' && <section className="panel p-4 sm:p-6 mb-6 space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><dt>Origin (self-reported)</dt><dd className="font-semibold">{record.data.decision_origin ? origins[record.data.decision_origin] || record.data.decision_origin : 'Not recorded'}</dd>{record.data.decision_origin_model && <dd className="break-words">{record.data.decision_origin_model}</dd>}</div>
          <div><dt>Registered on</dt><dd>{new Date(record.data.created_at).toLocaleDateString()}</dd></div>
          <div><dt>Access role</dt><dd>{workspace.role}</dd></div>
        </dl>
        <div><h2 className="font-semibold mb-2">{record.data.decision_origin ? 'Registered recommendation and rationale' : 'Decision context'}</h2><p className="whitespace-pre-wrap break-words text-sm">{record.data.description || 'No context recorded.'}</p></div>
        <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Registration does not independently verify the source or establish the original decision date.</p>
      </section>}
      {tab === 'Ownership' && <section className="panel p-5 space-y-3"><h2 className="font-semibold">Decision ownership</h2><p className="text-sm">Your workspace access role: <strong>{workspace.role}</strong>. This is not necessarily the accountable decision owner.</p><p className="text-sm">Domain owners and backup owners are managed in workspace settings.</p>{(workspace.role === 'owner' || workspace.role === 'admin') && <button className="btn-secondary" onClick={() => onNavigate('workspace-settings',workspace.id)}>Manage ownership & settings</button>}</section>}
      {tab === 'Approvals' && user && <DecisionApprovalPanel key={workspace.id} workspaceId={workspace.id} currentUserId={user.id} onChanged={() => { void lifecycle.refetch(); }} />}
      {tab === 'Versions' && <DecisionVersionHistory key={workspace.id} workspaceId={workspace.id} refreshKey={`${lifecycle.data?.status ?? 'unknown'}-${lifecycle.data?.approval_cycle ?? 0}`} />}
      {tab === 'Evidence' && (workspace.role === 'owner' || workspace.role === 'admin') && (lifecycle.data?.status === 'draft' ? <ExternalEvidenceForm key={workspace.id} workspaceId={workspace.id}/> : <p className="text-sm mb-4">Evidence registration requires a draft decision.</p>)}
      {(tab === 'Evidence' || tab === 'Audit Trail') && <TimelineView key={`${workspace.id}-${tab}`} workspaceId={workspace.id} workspaceName={record.data.name} onBack={back} section={tab === 'Evidence' ? 'evidence' : 'audit'} />}
    </>}
  </main>;
}
