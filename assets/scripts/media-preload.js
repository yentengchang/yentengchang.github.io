import {MediaDownloadQueue} from './media-download-queue.js?v=20260927c';
import {imageReady, imagesReady} from './visual-readiness.js?v=20260927c';

const root = '/auto-inspector/assets/';
const detail = location.pathname.startsWith('/auto-inspector/');
const definitions = [
  ['experience/home-flow/scan-camera.mp4', 'fc055bafd40a', 4746018],
  ['experience/home-flow/anchor-selected.mp4', '52dbbe42b6e3', 980284],
  ['experience/home-flow/workflow-full.mp4', '10c0acca1d98', 22473340],
  ['review/clips/ceiling-reference.mp4', '0d86df314dd9', 5109253],
  ['experience/field-studio.mp4', 'fc291221a5f1', 2488318],
  ['experience/field-multiroom.mp4', 'f0821439aa03', 2148256],
  ['experience/field-construction.mp4', '43a06795b8f7', 1118832]
].map(([path, hash, size], order) => ({url: root + path, key: root + path + '?v=' + hash,
  size, priority: detail ? (order >= 3 ? order - 3 : order + 4) : order}));
let cachePromise;
const mediaCache = () => cachePromise ??= ('caches' in window
  ? caches.open('ytc-recordings-v1').catch(() => null) : Promise.resolve(null));
const consumers = new Map(), videoEntries = new WeakMap(), preparing = new WeakMap();
const queue = new MediaDownloadQueue(definitions, {
  readCache: async entry => (await (await mediaCache())?.match(entry.key))?.blob(),
  writeCache: async (entry, blob) => (await mediaCache())?.put(entry.key,
    new Response(blob, {headers: {'Content-Type': 'video/mp4', 'Content-Length': String(blob.size)}})),
  onChange: entry => {
    for (const video of consumers.get(entry.url) || []) {
      video.dataset.mediaProgress = String(Math.floor(entry.loaded / entry.size * 100));
      const host = video.closest('.ai-visual-stage') || video.closest('figure');
      if (host && video.dataset.mediaStatus !== 'ready') {
        host.dataset.loadingLabel = entry.status === 'failed' ? 'Recording unavailable. Retry.'
          : 'Loading recording · ' + Math.floor(entry.loaded / entry.size * 100) + '%';
      }
    }
    document.dispatchEvent(new CustomEvent('site-media-state', {detail: {
      url: entry.url, status: entry.status, loaded: entry.loaded, total: entry.size
    }}));
  }
});
function entryFor(source) {
  try { return queue.entries.get(new URL(source, location.href).pathname); } catch { return null; }
}
export const holdMediaDownloads = () => queue.hold();
export function prioritizeMedia(source) { const entry = entryFor(source); if (entry) queue.prioritize(entry.url); }
export function setForegroundMedia(source) { queue.foreground(source ? entryFor(source)?.url : null); }

function decodedVideo(video, source) {
  return new Promise((resolve, reject) => {
    let timer;
    const clean = () => { clearTimeout(timer); video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed); };
    const loaded = () => { clean(); resolve(); };
    const failed = () => { clean(); reject(Error('Recording could not be decoded')); };
    video.addEventListener('loadeddata', loaded, {once: true}); video.addEventListener('error', failed, {once: true});
    timer = setTimeout(failed, 15000);
    video.src = source; video.preload = 'auto'; video.load();
    if (video.readyState >= 2) loaded();
  });
}
export function prepareVideo(video, {urgent = false, retry = false} = {}) {
  let entry = videoEntries.get(video);
  if (!entry) {
    const source = video.dataset.mediaSrc || video.getAttribute('src') || video.querySelector('source')?.getAttribute('src');
    entry = entryFor(source);
    if (!entry) return Promise.resolve();
    videoEntries.set(video, entry);
    if (!consumers.has(entry.url)) consumers.set(entry.url, new Set());
    consumers.get(entry.url).add(video);
    // Original HTML remains the no-JS path; no second native network job.
    video.removeAttribute('src'); video.querySelectorAll('source').forEach(node => node.removeAttribute('src'));
    video.preload = 'none'; video.load();
  }
  if (urgent) queue.prioritize(entry.url);
  if (video.dataset.mediaStatus === 'ready') return Promise.resolve(entry.blob);
  if (retry) { queue.retry(entry.url); preparing.delete(video); }
  if (preparing.has(video)) return preparing.get(video);
  video.dataset.mediaStatus = 'loading'; video.dataset.mediaMode = 'complete';
  video.dataset.mediaProgress = String(Math.floor(entry.loaded / entry.size * 100));
  const figure = video.closest('figure');
  figure?.classList.add('media-loading');
  if (figure) figure.dataset.loadingLabel = 'Loading recording · ' + video.dataset.mediaProgress + '%';
  const task = queue.ready(entry.url).then(async blob => {
    entry.objectURL ??= URL.createObjectURL(blob);
    if (!video.isConnected) return blob;
    await decodedVideo(video, entry.objectURL);
    video.dataset.mediaStatus = 'ready'; figure?.classList.remove('media-loading');
    figure?.querySelector('.media-retry')?.remove(); return blob;
  }).catch(error => {
    video.dataset.mediaStatus = 'failed'; figure?.classList.remove('media-loading');
    if (figure && !figure.querySelector('.media-retry')) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'media-retry';
      button.textContent = 'Retry recording';
      button.addEventListener('click', () => { button.remove(); prepareVideo(video, {urgent: true, retry: true}).catch(() => {}); });
      figure.append(button);
    }
    throw error;
  });
  // Background consumers have no awaiting UI. Explicit awaiters still see failures.
  task.catch(() => {}); preparing.set(video, task); return task;
}

function prioritizeLocation() {
  const map = {'#auto-inspector': 0, '#ai-scene-1': 0, '#ai-scene-2': 0,
    '#ai-scene-4': 1, '#ai-scene-6': 2, '#ceiling': 3, '#field': 4};
  const index = map[location.hash];
  if (index !== undefined) queue.prioritize(definitions[index].url);
}
async function start() {
  document.querySelectorAll('video').forEach(video => {
    prepareVideo(video);
    const promote = () => { const entry = videoEntries.get(video); if (entry) queue.prioritize(entry.url); };
    video.addEventListener('pointerdown', promote, {passive: true}); video.addEventListener('focusin', promote);
  });
  const videos = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.intersectionRatio - b.intersectionRatio);
    for (const item of visible) {
      const entry = videoEntries.get(item.target);
      if (entry) queue.prioritize(entry.url);
    }
  }, {rootMargin: '200px 0px'});
  document.querySelectorAll('video').forEach(video => videos.observe(video));

  // Large imagery belongs near its own project, not ahead of the opening.
  const visuals = new IntersectionObserver(entries => {
    for (const item of entries) if (item.isIntersecting) {
      visuals.unobserve(item.target);
      const release = queue.hold();
      const svgImages = [...item.target.querySelectorAll('image[data-media-href]')];
      const svgTasks = [...new Set(svgImages.map(image => image.dataset.mediaHref))].map(async url => {
        const image = new Image(); image.src = url;
        await imageReady(image);
        [...item.target.querySelectorAll('image[data-media-href]')].filter(node => node.dataset.mediaHref === url)
          .forEach(node => node.setAttribute('href', url));
      });
      Promise.allSettled([imagesReady(item.target), ...svgTasks]).then(results => {
        if (results.every(result => result.status === 'fulfilled')) {
          item.target.dataset.mediaVisuals = 'ready';
          item.target.dispatchEvent(new CustomEvent('site-visuals-ready'));
        }
      }).finally(release);
    }
  }, {rootMargin: '900px 0px'});
  document.querySelectorAll('#crack-monitoring, #lud').forEach(project => visuals.observe(project));

  addEventListener('hashchange', prioritizeLocation); prioritizeLocation();
  addEventListener('offline', () => queue.setOnline(false));
  addEventListener('online', () => queue.setOnline(true));
  queue.online = navigator.onLine;
  // Initial visible imagery has priority over speculative MP4 jobs.
  const initial = [...document.images].filter(image => {
    const box = image.getBoundingClientRect();
    return image.getAttribute('src') && box.width && box.top < innerHeight && box.bottom > 0;
  });
  await Promise.allSettled(initial.map(imageReady));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  queue.start();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
else start();
if (new URLSearchParams(location.search).has('ai-review')) window.__siteMedia = queue;
