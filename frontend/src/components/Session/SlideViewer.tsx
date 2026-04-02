import { useEffect, useCallback } from 'react';
import type { PresentationData } from '../../types';

interface SlideViewerProps {
  presentationData: PresentationData;
  currentSlide: number;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onGoToSlide: (n: number) => void;
}

export function SlideViewer({
  presentationData,
  currentSlide,
  onNextSlide,
  onPrevSlide,
  onGoToSlide,
}: SlideViewerProps) {
  const { slides, total_slides } = presentationData;
  const current = slides.find((s) => s.position === currentSlide);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        onNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onPrevSlide();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onNextSlide, onPrevSlide]);

  return (
    <div className="flex flex-col h-full">
      {/* Slide image area */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 p-2 min-h-0">
        {current?.image_url ? (
          <img
            src={current.image_url}
            alt={`Slide ${currentSlide}`}
            className="max-w-full max-h-full object-contain border-2 border-black shadow-[4px_4px_0px_#000]"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-64 border-2 border-dashed border-gray-600">
            <span className="text-gray-500 font-mono text-sm">Slide {currentSlide}</span>
          </div>
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-center gap-3 py-2 px-4 bg-gray-900 border-t-2 border-black">
        {/* Prev button */}
        <button
          onClick={onPrevSlide}
          disabled={currentSlide <= 1}
          className={`p-1.5 border-2 border-black transition-all ${
            currentSlide <= 1
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-yellow-400 hover:text-black'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1 items-center">
          {slides.map((s) => (
            <button
              key={s.position}
              onClick={() => onGoToSlide(s.position)}
              className={`transition-all ${
                s.position === currentSlide
                  ? 'w-6 h-2 bg-yellow-400 border border-black'
                  : 'w-2 h-2 bg-gray-600 hover:bg-gray-400 border border-gray-500'
              }`}
              title={s.title || `Slide ${s.position}`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={onNextSlide}
          disabled={currentSlide >= total_slides}
          className={`p-1.5 border-2 border-black transition-all ${
            currentSlide >= total_slides
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-yellow-400 hover:text-black'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Slide counter */}
        <span className="text-xs font-mono text-gray-400 ml-2">
          {currentSlide}/{total_slides}
        </span>
      </div>
    </div>
  );
}
