import { useState } from 'react';
import { TranscriptionOverlay } from './TranscriptionOverlay';
import { CoachingPanel } from './CoachingPanel';

interface SidePanelProps {
  scenarioTitle?: string;
  scenarioContext?: string;
}

export function SidePanel({ scenarioTitle, scenarioContext }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'coach' | 'info'>('coach');

  return (
    <div className="h-full flex flex-col bg-neutral-900/95 backdrop-blur-sm">
      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-white border-b-2 border-primary-500 bg-neutral-800/50'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/30'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Chat</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('coach')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'coach'
              ? 'text-white border-b-2 border-primary-500 bg-neutral-800/50'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/30'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="hidden sm:inline">Coach</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'info'
              ? 'text-white border-b-2 border-primary-500 bg-neutral-800/50'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/30'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Info</span>
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full">
            <TranscriptionOverlay variant="sidebar" />
          </div>
        )}

        {activeTab === 'coach' && (
          <CoachingPanel />
        )}

        {activeTab === 'info' && (
          <div className="h-full p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Scenario Info */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Cenario
                </h3>
                <p className="text-white font-medium">
                  {scenarioTitle || 'Carregando...'}
                </p>
              </div>

              {scenarioContext && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Contexto
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    {scenarioContext}
                  </p>
                </div>
              )}

              {/* Quick Tips */}
              <div className="mt-6 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <h4 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">
                  Dicas Rapidas
                </h4>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>• Use o metodo SPIN para guiar a conversa</li>
                  <li>• Deixe o cliente falar (30-50% voce)</li>
                  <li>• Responda objecoes com empatia</li>
                  <li>• Faca perguntas abertas</li>
                </ul>
              </div>

              {/* Keyboard shortcuts */}
              <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Atalhos
                </h4>
                <div className="text-sm text-neutral-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Pausar/Continuar</span>
                    <kbd className="px-2 py-0.5 bg-neutral-700 rounded text-xs">Espaco</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Encerrar sessao</span>
                    <kbd className="px-2 py-0.5 bg-neutral-700 rounded text-xs">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
