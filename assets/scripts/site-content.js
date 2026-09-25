document.querySelectorAll('.site-content-publications, .site-content-experience, .site-content-awards').forEach((section) => {
  const dialog = section.querySelector('.site-content-lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const links = [...section.querySelectorAll('[data-site-content-photo], [data-site-content-media]')];
  const image = dialog.querySelector('.site-content-lightbox-image');
  const title = dialog.querySelector('.site-content-lightbox-top p');
  const counter = dialog.querySelector('.site-content-photo-counter');
  const navigation = dialog.querySelector('.site-content-lightbox-bottom');
  const file = dialog.querySelector('.site-content-lightbox-file');
  const download = file.querySelector('a');
  const groupFor = (link) => link.dataset.siteContentPhoto || link.dataset.siteContentMedia;
  let gallery = [];
  let current = 0;
  let opener = null;

  const showItem = (index) => {
    current = (index + gallery.length) % gallery.length;
    const link = gallery[current];
    image.src = link.dataset.previewSrc || link.href;
    image.alt = link.querySelector('img').alt;
    title.textContent = link.dataset.caption;
    counter.textContent = `${current + 1} / ${gallery.length}`;
    navigation.hidden = gallery.length < 2;
    file.hidden = !link.dataset.previewSrc;
    dialog.classList.toggle('site-content-lightbox-document', !file.hidden);
    if (!file.hidden) download.href = link.href;
    else download.removeAttribute('href');
  };

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      gallery = links.filter((item) => groupFor(item) === groupFor(link));
      showItem(gallery.indexOf(link));
      dialog.showModal();
    });
  });

  dialog.querySelector('.site-content-lightbox-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.site-content-photo-previous').addEventListener('click', () => showItem(current - 1));
  dialog.querySelector('.site-content-photo-next').addEventListener('click', () => showItem(current + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button, a[href]')].filter((control) => control.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showItem(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
});
