import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface SubscriptionInfo {
  id: string;
  status: string;
  plan_version_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  plan_name?: string;
  base_fee_cents?: number;
}

interface Invoice {
  id: string;
  status: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  period_start: string;
  period_end: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
}

export function OrgBilling() {
  const navigate = useNavigate();
  const { organization, orgId } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    async function fetchBilling() {
      // Fetch active subscription
      const { data: sub } = await supabase
        .from('stripe_subscriptions')
        .select('*, plan_versions(base_fee_cents, plans(display_name))')
        .eq('org_id', orgId!)
        .in('status', ['active', 'trialing', 'past_due'])
        .single();

      if (sub) {
        setSubscription({
          ...sub,
          plan_name: (sub as any).plan_versions?.plans?.display_name,
          base_fee_cents: (sub as any).plan_versions?.base_fee_cents,
        });
      }

      // Fetch recent invoices
      const { data: invs } = await supabase
        .from('stripe_invoices')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(10);

      setInvoices((invs as Invoice[]) || []);
      setLoading(false);
    }

    fetchBilling();
  }, [orgId]);

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar a assinatura? Voce tera acesso ate o fim do periodo atual.')) return;

    setActionLoading(true);
    const { error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'cancel' },
    });

    if (!error) {
      setSubscription((prev) => prev ? { ...prev, cancel_at_period_end: true } : null);
    }
    setActionLoading(false);
  };

  const handleResume = async () => {
    setActionLoading(true);
    const { error } = await supabase.functions.invoke('manage-subscription', {
      body: { action: 'resume' },
    });

    if (!error) {
      setSubscription((prev) => prev ? { ...prev, cancel_at_period_end: false } : null);
    }
    setActionLoading(false);
  };

  const formatCurrency = (cents: number, currency = 'brl') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  const statusLabel: Record<string, string> = {
    active: 'Ativo',
    trialing: 'Periodo de teste',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelado',
  };

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Faturamento</h1>
            <p className="text-sm text-gray-500">{organization?.name}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Current Plan */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Plano atual</h2>

          {loading ? (
            <div className="animate-pulse h-16 bg-gray-100 rounded" />
          ) : subscription ? (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-black">{subscription.plan_name || 'Plano'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[subscription.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel[subscription.status] || subscription.status}
                  </span>
                </div>

                {subscription.base_fee_cents !== undefined && (
                  <p className="text-gray-600" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(subscription.base_fee_cents)}/mes</p>
                )}

                <p className="text-sm text-gray-400 mt-1">
                  Periodo: {formatDate(subscription.current_period_start)} — {formatDate(subscription.current_period_end)}
                </p>

                {subscription.trial_end && subscription.status === 'trialing' && (
                  <p className="text-sm text-blue-600 mt-1">
                    Trial termina em {formatDate(subscription.trial_end)}
                  </p>
                )}

                {subscription.cancel_at_period_end && (
                  <p className="text-sm text-red-600 mt-2">
                    Cancelamento agendado para {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {subscription.cancel_at_period_end ? (
                  <Button variant="primary" size="sm" loading={actionLoading} onClick={handleResume}>
                    Reativar
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" loading={actionLoading} onClick={handleCancel}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-3">Nenhuma assinatura ativa</p>
              <Button variant="primary" size="sm" onClick={() => navigate('/pricing')}>
                Ver planos
              </Button>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Faturas recentes</h2>

          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma fatura encontrada</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {formatCurrency(inv.amount_due_cents, inv.currency)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(inv.period_start)} — {formatDate(inv.period_end)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                      inv.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {inv.status === 'paid' ? 'Pago' : inv.status === 'open' ? 'Pendente' : inv.status}
                    </span>
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default OrgBilling;
