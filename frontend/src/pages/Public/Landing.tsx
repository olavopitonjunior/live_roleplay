import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b-2 border-black sticky top-0 bg-white z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-black uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Live Roleplay</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/pricing')} className="text-sm text-black font-bold uppercase tracking-wider hover:text-yellow-600">
              Precos
            </button>
            <button onClick={() => navigate('/contact')} className="text-sm text-black font-bold uppercase tracking-wider hover:text-yellow-600">
              Contato
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-sm font-bold text-black uppercase tracking-wider hover:text-yellow-600"
            >
              Entrar
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 bg-yellow-400 text-black text-sm font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Comecar gratis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold text-black leading-tight mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Treine sua equipe de vendas<br />com roleplay AI em tempo real
        </h1>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-10">
          Seus vendedores praticam negociacao com avatares AI que mantém personagem,
          contexto e reagem de forma realista. Feedback instantaneo com scores detalhados.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-3 bg-yellow-400 text-black font-bold border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-lg uppercase tracking-wider"
          >
            Teste gratis por 14 dias
          </button>
          <button
            onClick={() => navigate('/contact')}
            className="px-8 py-3 border-2 border-black text-black font-bold shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-lg uppercase tracking-wider"
          >
            Agendar demo
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 border-y-2 border-black">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-black text-center mb-12 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Como funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Cenarios realistas',
                desc: 'Cold calls, negociacoes, retencao de clientes. Cada cenario simula uma situacao real do dia-a-dia do vendedor.',
              },
              {
                title: 'AI que reage',
                desc: 'O avatar AI mantem personagem do inicio ao fim. Ele levanta objecoes, reage a argumentos e adapta o comportamento ao nivel do vendedor.',
              },
              {
                title: 'Feedback detalhado',
                desc: 'Apos cada sessao, um relatorio com score, pontos fortes, areas de melhoria e momentos-chave da conversa.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
                <h3 className="text-lg font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{f.title}</h3>
                <p className="text-gray-700">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-black text-center mb-12 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Para quem e</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { title: 'Gerentes de vendas', desc: 'Acompanhe o desempenho do time, atribua cenarios e identifique gaps de habilidade.' },
              { title: 'Treinadores', desc: 'Crie cenarios customizados para cada necessidade e acompanhe a evolucao dos treinandos.' },
              { title: 'Vendedores', desc: 'Pratique quantas vezes quiser, sem pressao. Melhore seu pitch e aprenda a lidar com objecoes.' },
              { title: 'RH e T&D', desc: 'Escale o treinamento de vendas sem depender de agenda. Metricas claras de ROI.' },
            ].map((u) => (
              <div key={u.title} className="flex gap-4 items-start">
                <div className="w-3 h-3 bg-yellow-400 border-2 border-black mt-1.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-black mb-1 uppercase tracking-wider">{u.title}</h3>
                  <p className="text-gray-700 text-sm">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-yellow-400 py-16 border-y-2 border-black">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-black mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Pronto para transformar seu time?</h2>
          <p className="text-black font-medium mb-8">14 dias gratis. Sem cartao de credito.</p>
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-3 bg-black text-white font-bold border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-lg uppercase tracking-wider"
          >
            Comecar agora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-black">
          <span className="font-bold">Live Roleplay &copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/pricing')} className="font-bold uppercase tracking-wider hover:text-yellow-600">Precos</button>
            <button onClick={() => navigate('/contact')} className="font-bold uppercase tracking-wider hover:text-yellow-600">Contato</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
