import React, { useState, useEffect, useRef } from 'react';
import { TRANSLATIONS } from '../translations';
import { Lang } from '../types';

// --- Component: PDF Page ---
export const PDFPage = ({
  pageNumber,
  pdfDoc,
  scale,
  defaultHeight,
  defaultWidth,
  onVisible,
  lang
}: {
  pageNumber: number;
  pdfDoc: any;
  scale: number;
  defaultHeight: number;
  defaultWidth: number;
  onVisible: (page: number) => void;
  lang: Lang;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [inView, setInView] = useState(false);
  const t = TRANSLATIONS[lang];

  // Observer for rendering (Lazy load)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50% 0px' } // Start rendering when within 50% of viewport height
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Observer for "Active Page" detection
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            onVisible(pageNumber);
          }
        });
      },
      { threshold: [0.1, 0.3, 0.5, 0.7] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Render logic
  useEffect(() => {
    if (!inView || !pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          await renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) return;

        // Resize canvas if needed
        if (canvas.height !== viewport.height || canvas.width !== viewport.width) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        setIsRendered(true);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNumber}`, err);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pageNumber, scale, inView]);

  return (
    <div 
      ref={containerRef}
      id={`page-${pageNumber}`}
      className="shadow-md mb-4 mx-auto relative bg-white transition-all duration-300"
      style={{
        width: 'fit-content',
        height: isRendered ? 'auto' : `${defaultHeight * scale}px`,
        minHeight: `${defaultHeight * scale}px`, // Placeholder height
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="block mx-auto" 
      />
      {!isRendered && inView && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
           {t.loading}
        </div>
      )}
    </div>
  );
};
