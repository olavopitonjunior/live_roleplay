import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { PresentationData, PresentationSlide } from '../types';

// Lazy-load pdfjs-dist only when needed
async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

async function renderPageToBlob(
  pdf: { getPage: (n: number) => Promise<unknown> },
  pageNum: number,
  scale: number = 1.5
): Promise<Blob> {
  const page = await pdf.getPage(pageNum) as {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  };
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/webp',
      0.85
    );
  });
}

export function usePresentation() {
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const abortRef = useRef(false);

  const totalSlides = presentationData?.total_slides ?? 0;

  const uploadPdf = useCallback(async (file: File, accessCode: string | null) => {
    setIsProcessing(true);
    setError(null);
    abortRef.current = false;

    try {
      // 1. Load PDF
      setProcessingStatus('Carregando PDF...');
      const pdfjsLib = await getPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      if (numPages > 30) {
        throw new Error('Maximo de 30 slides permitidos');
      }

      // 2. Render each page to WebP and upload to Storage
      const uploadId = crypto.randomUUID();
      const slides: PresentationSlide[] = [];

      for (let i = 1; i <= numPages; i++) {
        if (abortRef.current) break;
        setProcessingStatus(`Renderizando slide ${i}/${numPages}...`);

        const blob = await renderPageToBlob(pdf, i);
        const filePath = `presentations/${uploadId}/slide_${String(i).padStart(3, '0')}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('presentations')
          .upload(filePath, blob, { contentType: 'image/webp', upsert: true });

        if (uploadError) {
          console.error(`Upload error for slide ${i}:`, uploadError);
          throw new Error(`Falha ao enviar slide ${i}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('presentations')
          .getPublicUrl(filePath);

        slides.push({
          position: i,
          image_url: urlData.publicUrl,
          extracted_text: '',
          title: '',
        });
      }

      // 3. Upload original PDF
      setProcessingStatus('Salvando PDF original...');
      const pdfPath = `presentations/${uploadId}/original.pdf`;
      await supabase.storage
        .from('presentations')
        .upload(pdfPath, file, { contentType: 'application/pdf', upsert: true });

      const { data: pdfUrlData } = supabase.storage
        .from('presentations')
        .getPublicUrl(pdfPath);

      // 4. Extract text via Claude Vision API
      setProcessingStatus('Extraindo texto dos slides...');
      const { data: extractionData, error: extractError } = await supabase.functions.invoke(
        'manage-presentation',
        {
          body: {
            action: 'extract-text',
            access_code: accessCode,
            slides: slides.map((s) => ({ position: s.position, image_url: s.image_url })),
          },
        }
      );

      if (extractError) {
        console.error('Text extraction error:', extractError);
        // Continue with empty text — user can still present, avatar just won't have content
      }

      // Merge extraction results
      if (extractionData?.slides) {
        for (const extracted of extractionData.slides as PresentationSlide[]) {
          const slide = slides.find((s) => s.position === extracted.position);
          if (slide) {
            slide.extracted_text = extracted.extracted_text || '';
            slide.title = extracted.title || '';
            slide.data_points = extracted.data_points || [];
          }
        }
      }

      const result: PresentationData = {
        file_url: pdfUrlData.publicUrl,
        total_slides: numPages,
        slides,
      };

      setPresentationData(result);
      setCurrentSlide(1);
      setProcessingStatus('');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar PDF';
      setError(msg);
      setProcessingStatus('');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const removePresentation = useCallback(() => {
    abortRef.current = true;
    setPresentationData(null);
    setCurrentSlide(1);
    setError(null);
    setProcessingStatus('');
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToSlide = useCallback((n: number) => {
    setCurrentSlide(Math.max(1, Math.min(n, totalSlides)));
  }, [totalSlides]);

  return {
    presentationData,
    setPresentationData,
    isProcessing,
    processingStatus,
    error,
    currentSlide,
    totalSlides,
    uploadPdf,
    removePresentation,
    nextSlide,
    prevSlide,
    goToSlide,
  };
}
