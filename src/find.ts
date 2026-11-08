import type { FindResult, Reader } from './reader';

export class FindBar {
  private readonly bar = document.querySelector<HTMLElement>('#find-bar')!;
  private readonly toggle = document.querySelector<HTMLButtonElement>('#find-toggle')!;
  private readonly input = document.querySelector<HTMLInputElement>('#find-query')!;
  private readonly count = document.querySelector<HTMLElement>('#find-count')!;
  private readonly previous = document.querySelector<HTMLButtonElement>('#find-previous')!;
  private readonly next = document.querySelector<HTMLButtonElement>('#find-next')!;
  private available = false;
  private total = 0;

  constructor(private readonly reader: Reader) {
    this.toggle.addEventListener('click', () => this.bar.hidden ? this.open() : this.close());
    document.querySelector('#find-close')!.addEventListener('click', () => this.close());
    this.input.addEventListener('input', () => {
      this.total = 0;
      this.buttons();
      this.count.textContent = this.input.value ? 'Searching…' : '';
      if (this.input.value) this.reader.find(this.input.value);
      else this.reader.closeFind();
    });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); this.again(event.shiftKey); }
    });
    this.previous.addEventListener('click', () => this.again(true));
    this.next.addEventListener('click', () => this.again(false));
    document.addEventListener('keydown', event => {
      if (document.querySelector('dialog[open]') || event.altKey) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'f') { event.preventDefault(); this.open(); }
      else if (event.key === 'F3' || (command && event.key.toLowerCase() === 'g')) {
        event.preventDefault();
        if (this.bar.hidden) this.open();
        else this.again(event.shiftKey);
      } else if (event.key === 'Escape' && !this.bar.hidden) { event.preventDefault(); this.close(); }
    });
  }

  setAvailable(available: boolean): void {
    this.available = available;
    this.toggle.disabled = this.input.disabled = !available;
    this.buttons();
  }

  update(result: FindResult): void {
    if (this.bar.hidden || !this.input.value) return;
    this.total = result.total;
    this.count.textContent = result.pending ? 'Searching…' : result.total ? `${result.current} of ${result.total}` : 'No matches';
    this.buttons();
  }

  reset(): void {
    this.close(false);
    this.input.value = this.count.textContent = '';
    this.total = 0;
    this.buttons();
  }

  private buttons(): void { this.previous.disabled = this.next.disabled = !this.available || !this.total; }

  private open(): void {
    if (!this.available) return;
    this.bar.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    this.input.focus();
    this.input.select();
    if (this.input.value) this.reader.find(this.input.value);
  }

  private close(focus = true): void {
    if (!this.bar.hidden) this.reader.closeFind();
    this.bar.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    if (focus && this.available) this.toggle.focus();
  }

  private again(previous: boolean): void {
    if (this.available && this.input.value) this.reader.find(this.input.value, true, previous);
  }
}
