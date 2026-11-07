import {
  AnnotationEditorType,
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
} from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFViewer, ScrollMode } from 'pdfjs-dist/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface ReaderState {
  page: number;
  pages: number;
  scale: number;
  scaleValue: string;
}

export class Reader {
  private readonly events = new EventBus();
  private readonly links = new PDFLinkService();
  private readonly viewer: PDFViewer;
  private task: PDFDocumentLoadingTask | null = null;
  private generation = 0;

  constructor(container: HTMLDivElement, onChange: (state: ReaderState) => void) {
    this.links.externalLinkEnabled = false;
    this.viewer = new PDFViewer({
      container,
      eventBus: this.events,
      linkService: this.links,
      annotationMode: AnnotationMode.ENABLE,
      annotationEditorMode: AnnotationEditorType.DISABLE,
      enableAutoLinking: false,
      imageResourcesPath: new URL('/pdfjs/images/', window.location.href).href,
    });
    this.links.setViewer(this.viewer);
    this.viewer.scrollMode = ScrollMode.VERTICAL;
    const publish = () => onChange(this.state);
    this.events.on('pagechanging', publish);
    this.events.on('scalechanging', publish);
    this.events.on('pagesinit', () => {
      this.viewer.currentScaleValue = 'page-width';
      publish();
    });
    new ResizeObserver(() => {
      const value = this.viewer.currentScaleValue;
      if (value === 'page-width' || value === 'page-fit') this.viewer.currentScaleValue = value;
    }).observe(container);
  }

  get state(): ReaderState {
    return {
      page: this.viewer.currentPageNumber,
      pages: this.viewer.pagesCount,
      scale: this.viewer.currentScale,
      scaleValue: this.viewer.currentScaleValue || 'page-width',
    };
  }

  async open(data: Uint8Array): Promise<void> {
    const generation = ++this.generation;
    const old = this.task;
    this.task = null;
    this.viewer.setDocument(null);
    this.links.setDocument(null);
    await old?.destroy();
    if (generation !== this.generation) return;
    const assets = new URL('/pdfjs/', window.location.href).href;
    const task = getDocument({
      data,
      cMapUrl: `${assets}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`,
      wasmUrl: `${assets}wasm/`,
    });
    this.task = task;
    try {
      const document = await task.promise;
      if (generation !== this.generation) { await task.destroy(); return; }
      this.links.setDocument(document);
      this.viewer.setDocument(document);
      await this.viewer.firstPagePromise;
    } catch (error) {
      if (this.task === task) {
        this.task = null;
        this.viewer.setDocument(null);
        this.links.setDocument(null);
      }
      await task.destroy();
      throw error;
    }
  }

  goTo(page: number): void {
    if (Number.isInteger(page) && page >= 1 && page <= this.viewer.pagesCount) {
      this.viewer.currentPageNumber = page;
    }
  }

  zoom(value: string): void {
    this.viewer.currentScaleValue = value;
  }

  stepZoom(direction: 1 | -1): void {
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
    const current = this.viewer.currentScale;
    const next = direction === 1
      ? steps.find(value => value > current + 0.01) ?? 4
      : [...steps].reverse().find(value => value < current - 0.01) ?? 0.25;
    this.viewer.currentScaleValue = String(next);
  }
}
