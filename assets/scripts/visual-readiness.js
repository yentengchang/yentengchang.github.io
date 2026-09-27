export function imageReady(image) {
  image.loading = 'eager';
  return new Promise((resolve, reject) => {
    let timer;
    const clean = () => { clearTimeout(timer); image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
    const failed = () => { clean(); reject(Error('Scene image unavailable')); };
    const loaded = async () => {
      clean();
      if (!image.naturalWidth) return reject(Error('Scene image unavailable'));
      try { if (image.decode) await image.decode(); resolve(); } catch { reject(Error('Scene image could not be decoded')); }
    };
    if (image.complete) { loaded(); return; }
    image.addEventListener('load', loaded, {once: true}); image.addEventListener('error', failed, {once: true});
    timer = setTimeout(failed, 30000);
  });
}
export const imagesReady = root => Promise.all([...root.querySelectorAll('img')].map(imageReady));
