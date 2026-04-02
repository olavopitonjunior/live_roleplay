import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTracks } from '../../hooks/useTracks';
import { useScenarios } from '../../hooks/useScenarios';
import type { TrainingTrack } from '../../types';

function AdminTracksPage() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { tracks, loading, error, fetchTracks, createTrack, deleteTrack } = useTracks();
  const { scenarios } = useScenarios();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchTracks(accessCode?.code ?? null);
  }, [accessCode?.code, fetchTracks]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    const result = await createTrack(accessCode?.code ?? null, {
      title: newTitle.trim(),
      slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      description: newDescription.trim() || undefined,
      category: newCategory.trim() || undefined,
      scenarios: [],
    });
    if (result) {
      setShowCreate(false);
      setNewTitle('');
      setNewSlug('');
      setNewDescription('');
      setNewCategory('');
      fetchTracks(accessCode?.code ?? null);
    }
  }, [accessCode?.code, newTitle, newSlug, newDescription, newCategory, createTrack, fetchTracks]);

  const handleDelete = useCallback(async (trackId: string, trackTitle: string) => {
    if (!confirm(`Desativar esteira "${trackTitle}"?`)) return;
    await deleteTrack(accessCode?.code ?? null, trackId);
    fetchTracks(accessCode?.code ?? null);
  }, [accessCode?.code, deleteTrack, fetchTracks]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
            >
              &larr; Home
            </button>
            <h1 className="text-xl font-bold text-black uppercase tracking-tight">Esteiras de Treinamento</h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-yellow-400 text-black font-bold text-sm border-2 border-black
                       shadow-[4px_4px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1
                       transition-all uppercase tracking-wider"
          >
            + Nova Esteira
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-white border-2 border-black text-black font-mono">{error}</div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-8 p-6 bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
            <h2 className="text-lg font-bold text-black uppercase tracking-wider mb-4">Nova Esteira</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">Titulo</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black text-sm"
                  placeholder="Captacao de Imoveis"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">Slug (URL)</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black text-sm"
                  placeholder="captacao-imoveis"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">Categoria</label>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black text-sm"
                  placeholder="RE/MAX"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">Descricao</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black text-sm"
                  placeholder="Domine as tecnicas de..."
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4 font-mono">
              Cenarios podem ser adicionados apos a criacao da esteira.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-yellow-400 text-black font-bold text-sm border-2 border-black
                           shadow-[4px_4px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1
                           transition-all uppercase tracking-wider"
              >
                Criar
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-white text-black font-bold text-sm border-2 border-black
                           hover:bg-gray-100 transition-all uppercase tracking-wider"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tracks list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-gray-100 border-2 border-black animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300">
            <p className="text-black font-bold mb-2">Nenhuma esteira criada</p>
            <p className="text-sm text-gray-500">Crie sua primeira esteira de treinamento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map((track: TrainingTrack) => (
              <div
                key={track.id}
                className="p-4 bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-black">{track.title}</h3>
                    {track.category && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
                        {track.category}
                      </span>
                    )}
                  </div>
                  {track.description && (
                    <p className="text-sm text-gray-600 line-clamp-1">{track.description}</p>
                  )}
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    /{track.slug} &bull; {track.track_scenarios?.length ?? 0} cenarios
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => navigate(`/tracks/${track.slug}`)}
                    className="px-3 py-1 text-xs font-bold text-black border-2 border-black hover:bg-yellow-50 transition-colors uppercase tracking-wider"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() => handleDelete(track.id, track.title)}
                    className="px-3 py-1 text-xs font-bold text-red-600 border-2 border-red-300 hover:bg-red-50 transition-colors uppercase tracking-wider"
                  >
                    Desativar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminTracksPage;
