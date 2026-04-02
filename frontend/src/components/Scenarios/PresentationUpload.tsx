import { useCallback, useRef, useState } from 'react';
import type { PresentationData } from '../../types';

interface PresentationUploadProps {
  onUpload: (file: File) => Promise<PresentationData | null>;
  onRemove: () => void;
  presentationData: PresentationData | null;
  isProcessing: boolean;
  processingStatus: string;
  error: string | null;
}

export function PresentationUpload({
  onUpload,
  onRemove,
  presentationData,
  isProcessing,
  processingStatus,
  error,
}: PresentationUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        return;
      }
      await onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Already uploaded — show summary
  if (presentationData) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border-2 border-black">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold text-black">
            {presentationData.total_slides} slides extraidos
          </span>
        </div>
        <button
          onClick={onRemove}
          className="text-xs font-bold text-red-600 hover:text-red-800 uppercase tracking-wider"
        >
          Remover
        </button>
      </div>
    );
  }

  // Processing
  if (isProcessing) {
    return (
      <div className="p-4 border-2 border-black bg-yellow-50">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent animate-spin" />
          <span className="text-sm font-bold text-black">{processingStatus || 'Processando...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 border-2 border-dashed cursor-pointer transition-all text-center ${
          isDragging
            ? 'border-yellow-500 bg-yellow-50'
            : 'border-gray-400 hover:border-black hover:bg-gray-50'
        }`}
      >
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-bold text-black">
          Arraste um PDF aqui ou clique para selecionar
        </p>
        <p className="text-xs text-gray-500 mt-1 font-mono">PDF, max 30 slides</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-600 mt-2 font-mono">{error}</p>
      )}
    </div>
  );
}
