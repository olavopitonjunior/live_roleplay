import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PlanCard {
  name: string;
  slug: string;
  price: number;
  priceYearly: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PLANS: PlanCard[] = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 99,
    priceYearly: 79,
    description: 'Para equipes pequenas comecando com roleplay AI.',
    features: [
      'Ate 10 usuarios',
      '100 sessoes/mes',
      '3 cenarios customizados',
      'Feedback com score',
      'Coach em tempo real',
    ],
    cta: 'Comecar gratis',
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: 299,
    priceYearly: 239,
    description: 'Para times de vendas em crescimento.',
    features: [
      'Ate 50 usuarios',
      '500 sessoes/mes',
      '20 cenarios customizados',
      'Dashboard do gerente',
      'Times e atribuicoes',
      'Analytics avancado',
      'Exportar relatorios',
    ],
    highlighted: true,
    cta: 'Comecar gratis',
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 999,
    priceYearly: 799,
    description: 'Para grandes organizacoes com necessidades customizadas.',
    features: [
      'Usuarios ilimitados',
      'Sessoes ilimitadas',
      'Cenarios ilimitados',
      'Tudo do Professional',
      'API access',
      'SSO (em breve)',
      'Suporte prioritario',
      'Onboarding dedicado',
    ],
    cta: 'Falar com vendas',
  },
];

export function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const handleCTA = (plan: PlanCard) => {
    if (plan.slug === 'enterprise') {
      navigate('/contact');
    } else {
      navigate(`/signup?plan=${plan.slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b-2 border-black sticky top-0 bg-white z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/landing')} className="text-xl font-bold text-black uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Live Roleplay
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-sm font-bold text-black uppercase tracking-wider hover:text-yellow-600">
              Entrar
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black mb-4 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Planos e precos</h1>
          <p className="text-lg text-gray-700 mb-8">14 dias gratis em todos os planos. Sem cartao de credito.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-0 border-2 border-black">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                !annual ? 'bg-yellow-400 text-black' : 'bg-white text-gray-700'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border-l-2 border-black ${
                annual ? 'bg-yellow-400 text-black' : 'bg-white text-gray-700'
              }`}
            >
              Anual (-20%)
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`border-2 border-black p-8 flex flex-col shadow-[4px_4px_0px_#000] ${
                plan.highlighted
                  ? 'ring-2 ring-yellow-400 bg-yellow-50'
                  : 'bg-white'
              }`}
            >
              {plan.highlighted && (
                <span className="text-xs font-bold text-black bg-yellow-400 px-2 py-1 border-2 border-black self-start mb-3 uppercase tracking-wider">
                  Mais popular
                </span>
              )}
              <h3 className="text-xl font-bold text-black uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{plan.name}</h3>
              <p className="text-sm text-gray-700 mt-1 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-black" style={{ fontFamily: 'Space Mono, monospace' }}>
                  R${annual ? plan.priceYearly : plan.price}
                </span>
                <span className="text-gray-700 font-bold">/mes</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-800">
                    <svg className="w-4 h-4 text-black mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCTA(plan)}
                className={`w-full py-3 font-bold uppercase tracking-wider transition-all border-2 border-black ${
                  plan.highlighted
                    ? 'bg-yellow-400 text-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px]'
                    : 'bg-white text-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Pricing;
