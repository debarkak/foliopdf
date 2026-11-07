import {
  AnnotationEditorType,
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  PDFWorker,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
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

export interface ReaderDocument {
  task: PDFDocumentLoadingTask;
  pdf: PDFDocumentProxy;
  view?: { page: number; scale: string; point: number[] };
}

export class Reader {
  private readonly events = new EventBus();
  private readonly links = new PDFLinkService();
  private readonly viewer: PDFViewer;
  private readonly worker = new PDFWorker();
  private active: ReaderDocument | null = null;
  private readonly container: HTMLDivElement;

  constructor(container: HTMLDivElement, onChange: (state: ReaderState) => void) {
    this.container = container;
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

  async load(data: Uint8Array): Promise<ReaderDocument> {
    const assets = new URL('/pdfjs/', window.location.href).href;
    const task = getDocument({
      data,
      worker: this.worker,
      cMapUrl: `${assets}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`,
      wasmUrl: `${assets}wasm/`,
    });
    try {
      return { task, pdf: await task.promise };
    } catch (error) {
      await task.destroy();
      throw error;
    }
  }

  async show(document: ReaderDocument | null): Promise<void> {
    if (this.active) {
      const page = this.viewer.getPageView(this.state.page - 1);
      if (page) this.active.view = {
        page: this.state.page,
        scale: this.state.scaleValue,
        point: page.getPagePoint(this.container.scrollLeft - page.div.offsetLeft, this.container.scrollTop - page.div.offsetTop),
      };
    }
    // Detaching destroys the old page views/canvases, but keeps its loaded PDF.
    this.viewer.setDocument(null);
    this.links.setDocument(null);
    this.active = document;
    if (!document) return;

    let initialized: () => void;
    const ready = new Promise<void>(resolve => {
      initialized = () => {
        const view = document.view;
        this.viewer.currentScaleValue = view?.scale || 'page-width';
        if (view) this.viewer.scrollPageIntoView({
          pageNumber: view.page,
          destArray: [null, { name: 'XYZ' }, ...view.point, null],
          ignoreDestinationZoom: true,
          allowNegativeOffset: true,
        });
        resolve();
      };
      this.events.on('pagesinit', initialized);
    });
    try {
      this.links.setDocument(document.pdf);
      this.viewer.setDocument(document.pdf);
      await this.viewer.firstPagePromise;
      await ready;
    } finally {
      this.events.off('pagesinit', initialized!);
    }
  }

  async close(document: ReaderDocument): Promise<void> {
    if (this.active === document) await this.show(null);
    await document.task.destroy();
  }

  goTo(page: number): void {
    if (Number.isInteger(page) && page >= 1 && page <= this.viewer.pagesCount) {
      this.viewer.currentPageNumber = page;
    }
  }

  zoom(value: string): void {
    const page = this.viewer.currentPageNumber;
    this.viewer.currentScaleValue = value;
    // A pending scroll update can leave PDF.js with the previous page's anchor.
    if (this.viewer.currentPageNumber !== page) this.viewer.currentPageNumber = page;
  }

  stepZoom(direction: 1 | -1): void {
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
    const current = this.viewer.currentScale;
    const next = direction === 1
      ? steps.find(value => value > current + 0.01) ?? 4
      : [...steps].reverse().find(value => value < current - 0.01) ?? 0.25;
    this.zoom(String(next));
  }
}
