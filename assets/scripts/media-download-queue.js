// One network lane, reselected between bounded byte ranges. Playback never
// shares the network job: consumers receive only a complete, validated Blob.
export class MediaDownloadQueue {
  constructor(definitions, {fetcher = (...args) => fetch(...args), readCache = async () => null,
    writeCache = async () => {}, onChange = () => {}, chunkSize = 512 * 1024,
    timeout = 15000, retryDelay = 1000, maxAttempts = 3} = {}) {
    this.entries = new Map(definitions.map((item, order) => [item.url, {
      ...item, order, priority: item.priority ?? order, boost: 0, status: 'queued',
      loaded: 0, parts: [], attempts: 0, retryAt: 0, checkedCache: false, waiters: []
    }]));
    Object.assign(this, {fetcher, readCache, writeCache, onChange, chunkSize, timeout, retryDelay, maxAttempts});
    this.holds = 1; this.sequence = 0; this.online = true; this.running = false;
  }
  start() { if (!this.started) { this.started = true; this.holds--; this.pump(); } }
  hold() {
    this.holds++;
    let released = false;
    return () => { if (!released) { released = true; this.holds--; this.pump(); } };
  }
  setOnline(value) {
    this.online = value;
    if (value) for (const entry of this.entries.values()) {
      if (entry.status === 'failed') this.retry(entry.url);
      entry.retryAt = 0;
    }
    this.pump();
  }
  foreground(url) { this.foregroundURL = url; this.pump(); }
  prioritize(url) { const entry = this.entries.get(url); if (entry) entry.boost = ++this.sequence; this.pump(); }
  retry(url) {
    const entry = this.entries.get(url);
    if (entry?.status === 'failed') {
      entry.status = 'queued'; entry.attempts = 0; entry.retryAt = 0; entry.error = null;
      this.changed(entry); this.pump();
    }
  }
  ready(url) {
    const entry = this.entries.get(url);
    if (!entry) return Promise.reject(new Error('Unknown recording'));
    if (entry.status === 'ready') return Promise.resolve(entry.blob);
    if (entry.status === 'failed') return Promise.reject(entry.error);
    return new Promise((resolve, reject) => entry.waiters.push({resolve, reject}));
  }
  changed(entry) { this.onChange(entry); }
  complete(entry, blob, cached = false) {
    entry.blob = blob; entry.loaded = blob.size; entry.parts = []; entry.status = 'ready';
    entry.waiters.splice(0).forEach(waiter => waiter.resolve(blob));
    this.changed(entry);
    // Storage is best effort. Neither playback nor the next job waits for it.
    if (!cached) Promise.resolve().then(() => this.writeCache(entry, blob)).catch(() => {});
  }
  next() {
    const now = Date.now();
    const queued = [...this.entries.values()].filter(entry => entry.status === 'queued' && entry.retryAt <= now);
    return queued.sort((a, b) => {
      const front = Number(b.url === this.foregroundURL) - Number(a.url === this.foregroundURL);
      return front || b.boost - a.boost || a.priority - b.priority || a.order - b.order;
    })[0];
  }
  async pump() {
    if (this.running || this.holds || !this.online) return;
    clearTimeout(this.timer);
    const entry = this.next();
    if (!entry) {
      const dates = [...this.entries.values()].filter(e => e.status === 'queued').map(e => e.retryAt);
      if (dates.length) this.timer = setTimeout(() => this.pump(), Math.max(1, Math.min(...dates) - Date.now()));
      return;
    }
    this.running = true; entry.status = 'loading'; this.changed(entry);
    try {
      if (!entry.checkedCache) {
        entry.checkedCache = true;
        let timer;
        const cached = await Promise.race([
          Promise.resolve().then(() => this.readCache(entry)).catch(() => null),
          new Promise(resolve => { timer = setTimeout(() => resolve(null), 1000); })
        ]).finally(() => clearTimeout(timer));
        if (cached?.size === entry.size) this.complete(entry, cached, true);
      }
      if (entry.status !== 'ready') {
        // A foreground visual may have acquired a hold during the cache read.
        if (!this.holds && this.online) await this.range(entry);
        if (entry.status !== 'ready') entry.status = 'queued';
      }
    } catch (error) {
      entry.error = error; entry.attempts++;
      entry.status = entry.attempts >= this.maxAttempts ? 'failed' : 'queued';
      entry.retryAt = Date.now() + this.retryDelay * 2 ** (entry.attempts - 1);
      if (entry.status === 'failed') entry.waiters.splice(0).forEach(waiter => waiter.reject(error));
      this.changed(entry);
    } finally {
      this.running = false;
      this.pump();
    }
  }
  async range(entry) {
    const start = entry.loaded, end = Math.min(entry.size - 1, start + this.chunkSize - 1);
    const controller = new AbortController(); let timer;
    const resetTimer = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), this.timeout); };
    resetTimer();
    try {
      const response = await this.fetcher(entry.key, {
        headers: {Range: `bytes=${start}-${end}`}, signal: controller.signal,
        priority: entry.url === this.foregroundURL ? 'high' : 'low'
      });
      if (response.status !== 200 && response.status !== 206) throw Error(`Recording request: HTTP ${response.status}`);
      const full = response.status === 200;
      if (!full) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
        if (!match || +match[1] !== start || +match[2] !== end || +match[3] !== entry.size)
          throw Error('Invalid recording byte range');
        const tag = response.headers.get('ETag');
        if (tag && entry.etag && tag !== entry.etag) {
          entry.parts = []; entry.loaded = 0; entry.etag = null;
          throw Error('Recording changed during transfer');
        }
        if (tag) entry.etag = tag;
      }
      const expected = full ? entry.size : end - start + 1;
      const chunks = []; let received = 0;
      const reader = response.body.getReader();
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > expected) throw Error('Recording response is too large');
        chunks.push(value); resetTimer();
      }
      if (received !== expected) throw Error('Incomplete recording response');
      const part = new Blob(chunks, {type: 'video/mp4'});
      if (full) { entry.parts = [part]; entry.loaded = part.size; }
      else { entry.parts.push(part); entry.loaded += part.size; }
      entry.attempts = 0; entry.retryAt = 0;
      if (entry.loaded === entry.size) this.complete(entry, new Blob(entry.parts, {type: 'video/mp4'}));
      else this.changed(entry);
    } finally {
      clearTimeout(timer);
      // Abort only a failed/stalled range, never a completed prefix on a jump.
      controller.abort();
    }
  }
}
