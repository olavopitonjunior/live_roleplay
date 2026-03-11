import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

export function OrgSettings() {
  const navigate = useNavigate();
  const { organization, orgId } = useAuth();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setIndustry((organization as any).industry || '');
    setSettings(organization.settings || {});
  }, [organization]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('organizations')
      .update({
        name,
        industry: industry || null,
        settings,
      })
      .eq('id', orgId);

    setSaving(false);
    if (!error) setSaved(true);
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Configuracoes da Organizacao</h1>
            <p className="text-sm text-gray-500">{organization?.name}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* General */}
        <section className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Geral</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => { setIndustry(e.target.value); setSaved(false); }}
                placeholder="Ex: Imobiliario, Tecnologia, Saude"
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </section>

        {/* Session Defaults */}
        <section className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Sessoes</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duracao maxima da sessao (segundos)
              </label>
              <input
                type="number"
                value={settings.max_session_duration_seconds ?? 600}
                onChange={(e) => updateSetting('max_session_duration_seconds', parseInt(e.target.value) || 600)}
                min={60}
                max={1800}
                className="w-32 px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modo padrao</label>
              <select
                value={settings.default_session_mode ?? 'training'}
                onChange={(e) => updateSetting('default_session_mode', e.target.value)}
                className="w-48 px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="training">Treinamento</option>
                <option value="evaluation">Avaliacao</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="coach_enabled"
                checked={settings.coach_enabled ?? true}
                onChange={(e) => updateSetting('coach_enabled', e.target.checked)}
                className="rounded border-black text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="coach_enabled" className="text-sm text-gray-700">Coach em tempo real habilitado</label>
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
          <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Marca</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor primaria</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.branding?.primary_color ?? '#6366f1'}
                  onChange={(e) => updateSetting('branding', { ...settings.branding, primary_color: e.target.value })}
                  className="h-10 w-10 border-2 border-black cursor-pointer"
                />
                <span className="text-sm text-gray-500">{settings.branding?.primary_color ?? '#6366f1'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Salvar alteracoes
          </Button>
          {saved && <span className="text-sm text-green-600">Salvo com sucesso</span>}
        </div>
      </main>
    </div>
  );
}

export default OrgSettings;
