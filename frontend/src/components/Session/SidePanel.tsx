import { useState } from 'react';
import { TranscriptionOverlay } from './TranscriptionOverlay';

interface SidePanelProps {
  scenarioTitle?: string;
  scenarioContext?: string;
}

export function SidePanel({ scenarioTitle, scenarioContext }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'info'>('chat');

  return (
    <div className="h-full flex flex-col bg-neutral-900/95 backdrop-blur-sm">
      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-white border-b-2 border-primary-500 bg-neutral-800/50'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/30'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </span>
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'info'
              ? 'text-white border-b-2 border-primary-500 bg-neutral-800/50'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/30'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Info
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="h-full p-4">
            <TranscriptionOverlay variant="sidebar" />
          </div>
        ) : (
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

              {/* Tips */}
              <div className="mt-6 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <h4 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">
                  Dicas
                </h4>
                <ul className="text-sm text-neutral-400 space-y-1">
                  <li>• Escute atentamente as objecoes</li>
                  <li>• Seja empático com o cliente</li>
                  <li>• Apresente solucoes claras</li>
                  <li>• Mantenha o tom profissional</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
