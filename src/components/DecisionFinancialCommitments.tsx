import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Commitment {
  id: string;
  description: string;
  amount: string;
  currency: string;
  assumptions: string;
}

interface DecisionFinancialCommitmentsProps {
  workspaceId: string;
  currentUserId: string;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export default function DecisionFinancialCommitments({ workspaceId, currentUserId }: DecisionFinancialCommitmentsProps) {
  const [items, setItems] = useState<Commitment[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [assumptions, setAssumptions] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [itemRes, memberRes] = await Promise.all([
      supabase
        .from('decision_financial_commitments')
        .select('id, description, amount, currency, assumptions')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', currentUserId)
        .maybeSingle(),
    ]);
    if (itemRes.error || memberRes.error) {
      setError('Financial commitments could not be loaded.');
      setLoading(false);
      return;
    }
    setItems((itemRes.data ?? []) as Commitment[]);
    setCanEdit(memberRes.data?.role === 'owner' || memberRes.data?.role === 'admin');
    setLoading(false);
  }, [workspaceId, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCurrency('USD');
    setAssumptions('');
    setAdding(false);
  };

  const handleAdd = async () => {
    const trimmed = description.trim();
    const cleanAmount = amount.trim();
    const cleanCurrency = currency.trim().toUpperCase();
    if (!trimmed || trimmed.length > 500) {
      setError('Describe the commitment in up to 500 characters.');
      return;
    }
    if (!AMOUNT_PATTERN.test(cleanAmount)) {
      setError('Enter an amount with up to two decimal places.');
      return;
    }
    if (!CURRENCY_PATTERN.test(cleanCurrency)) {
      setError('Use a three-letter currency code such as USD or EUR.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: insertError } = await supabase.from('decision_financial_commitments').insert({
      workspace_id: workspaceId,
      description: trimmed,
      amount: cleanAmount,
      currency: cleanCurrency,
      assumptions: assumptions.trim(),
    });
    setBusy(false);
    if (insertError) {
      setError('The commitment could not be saved. Check that you have owner or admin access.');
      return;
    }
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError('');
    const { error: deleteError } = await supabase.from('decision_financial_commitments').delete().eq('id', id);
    setBusy(false);
    if (deleteError) {
      setError('The commitment could not be removed.');
      return;
    }
    load();
  };

  const inputClass = 'w-full rounded-md border px-3 py-2 text-sm';
  const inputStyle = { borderColor: '#cbd5e1', color: '#0f172a', background: '#ffffff' };

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: '#e2e8f0' }}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Financial commitments</h4>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: '#0f766e' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add commitment
          </button>
        )}
      </div>
      <p className="mt-1 text-xs" style={{ color: '#475569' }}>
        Changing any commitment after approval sends the decision back for a new approval.
      </p>

      {loading && <Loader2 className="w-4 h-4 mt-3 animate-spin" style={{ color: '#64748b' }} />}

      {!loading && items.length === 0 && !adding && (
        <p className="mt-2 text-xs" style={{ color: '#475569' }}>No financial commitments recorded.</p>
      )}

      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3" style={{ borderColor: '#e2e8f0' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{item.description}</p>
                <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{item.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                {item.assumptions && (
                  <p className="text-xs mt-1" style={{ color: '#475569' }}>Assumptions: {item.assumptions}</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={busy}
                  aria-label="Remove commitment"
                  className="shrink-0 p-1 rounded hover:bg-slate-100 disabled:opacity-50"
                  style={{ color: '#991b1b' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 space-y-2">
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="What is committed (for example, annual vendor licence)"
            maxLength={500}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="Amount"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="USD"
              maxLength={3}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            />
          </div>
          <textarea
            className={inputClass}
            style={inputStyle}
            rows={2}
            placeholder="Assumptions behind this figure (optional)"
            maxLength={2000}
            value={assumptions}
            onChange={e => setAssumptions(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50"
              style={{ background: '#0f766e', color: '#ffffff' }}
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save commitment
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="rounded-md px-3 py-2 text-xs font-medium"
              style={{ color: '#334155' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#991b1b' }}>
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
