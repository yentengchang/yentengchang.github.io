(() => {
  const story = document.querySelector('[data-crack-story]');
  if (!story) return;

  const shell = story.querySelector('.crack-scroll-shell');
  const stage = story.querySelector('.crack-pinned-stage');
  const stateMarkers = [...story.querySelectorAll('.crack-scroll-states [data-crack-state]')];
  const copySections = [...story.querySelectorAll('[data-crack-copy]')];
  const stateNames = stateMarkers.map((marker) => marker.dataset.crackState);
  let activeState = '';
  let frameRequested = false;

  const activate = (state) => {
    if (!state || state === activeState) return;
    activeState = state;
    story.dataset.state = state;

    copySections.forEach((section) => {
      const isActive = section.dataset.crackCopy === state;
      section.classList.toggle('is-active', isActive);
      section.setAttribute('aria-hidden', String(!isActive));
    });
  };

  const updateFromScroll = () => {
    frameRequested = false;
    const shellRect = shell.getBoundingClientRect();
    const stickyTop = Number.parseFloat(getComputedStyle(stage).top) || 0;
    const travel = Math.max(1, shell.offsetHeight - stage.offsetHeight);
    const progress = Math.min(1, Math.max(0, (stickyTop - shellRect.top) / travel));
    const index = Math.min(stateNames.length - 1, Math.floor(progress * stateNames.length));
    activate(stateNames[index]);
  };

  const queueUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(updateFromScroll);
  };

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const jet = (value) => {
    const r = clamp(1.5 - Math.abs((4 * value) - 3), 0, 1);
    const g = clamp(1.5 - Math.abs((4 * value) - 2), 0, 1);
    const b = clamp(1.5 - Math.abs((4 * value) - 1), 0, 1);
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const getClusters = (positions) => {
    if (!positions.length) return [];
    const clusters = [];
    let cluster = [positions[0]];

    for (let index = 1; index < positions.length; index += 1) {
      if (positions[index] - positions[index - 1] <= 2) {
        cluster.push(positions[index]);
      } else {
        clusters.push(cluster);
        cluster = [positions[index]];
      }
    }

    clusters.push(cluster);
    return clusters;
  };

  const prepareAnalysisLayers = () => {
    const maskCanvas = story.querySelector('.crack-mask-canvas');
    const skeletonCanvas = story.querySelector('.crack-skeleton-canvas');
    const distanceCanvas = story.querySelector('.crack-distance-canvas');
    const scanCanvas = story.querySelector('.crack-width-scan-canvas');
    const maxCanvas = story.querySelector('.crack-width-max-canvas');
    if (!maskCanvas || !skeletonCanvas || !distanceCanvas || !scanCanvas || !maxCanvas) return;

    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const source = new Image();

    source.addEventListener('load', () => {
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });

      /*
       * The reference is the actual v1 result screenshot supplied for this project.
       * Its camera image occupies x=22..897 and y=40..915 in the 924×932 capture.
       */
      scratchContext.drawImage(source, 22, 40, 875, 875, 0, 0, width, height);
      const sourcePixels = scratchContext.getImageData(0, 0, width, height).data;
      const bluePixelsByRow = Array.from({ length: height }, () => []);
      const columnCounts = new Uint16Array(width);
      const rowCounts = new Uint16Array(height);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = ((y * width) + x) * 4;
          const red = sourcePixels[offset];
          const green = sourcePixels[offset + 1];
          const blue = sourcePixels[offset + 2];
          const isSegmentationBlue = blue > 105 && blue - red > 28 && blue - green > 16;

          if (isSegmentationBlue) {
            bluePixelsByRow[y].push(x);
            columnCounts[x] += 1;
            rowCounts[y] += 1;
          }
        }
      }

      const straightColumns = new Set();
      const straightRows = new Set();
      columnCounts.forEach((count, x) => {
        if (count > height * 0.48) straightColumns.add(x);
      });
      rowCounts.forEach((count, y) => {
        if (count > width * 0.48) straightRows.add(y);
      });

      const rows = Array.from({ length: height }, () => null);
      let previousCenter = null;

      for (let y = height - 1; y >= 0; y -= 1) {
        const cleaned = bluePixelsByRow[y].filter((x) => {
          if (straightRows.has(y)) return false;
          if ([...straightColumns].some((column) => Math.abs(column - x) <= 2)) return false;
          if (y < 17 && x < 240) return false;
          return true;
        });
        const clusters = getClusters(cleaned).filter((cluster) => cluster.length >= 2);
        if (!clusters.length) continue;

        const ranked = clusters
          .map((cluster) => {
            const left = cluster[0];
            const right = cluster[cluster.length - 1];
            const center = (left + right) / 2;
            const continuity = previousCenter === null ? 0 : Math.abs(center - previousCenter);
            return { left, right, center, score: cluster.length - (continuity * 1.4) };
          })
          .sort((a, b) => b.score - a.score);

        const selected = previousCenter === null
          ? ranked.sort((a, b) => b.right - b.left - (a.right - a.left))[0]
          : ranked.find((candidate) => Math.abs(candidate.center - previousCenter) < 34) || ranked[0];

        rows[y] = selected;
        previousCenter = selected.center;
      }

      let previousKnown = null;
      for (let y = 0; y < height; y += 1) {
        if (rows[y]) {
          previousKnown = y;
          continue;
        }

        let nextKnown = y + 1;
        while (nextKnown < height && !rows[nextKnown]) nextKnown += 1;
        if (previousKnown === null || nextKnown >= height || nextKnown - previousKnown > 16) continue;

        const ratio = (y - previousKnown) / (nextKnown - previousKnown);
        rows[y] = {
          left: rows[previousKnown].left + ((rows[nextKnown].left - rows[previousKnown].left) * ratio),
          right: rows[previousKnown].right + ((rows[nextKnown].right - rows[previousKnown].right) * ratio),
          center: rows[previousKnown].center + ((rows[nextKnown].center - rows[previousKnown].center) * ratio)
        };
      }

      const maskContext = maskCanvas.getContext('2d');
      const maskImage = maskContext.createImageData(width, height);
      const distanceContext = distanceCanvas.getContext('2d');
      const distanceImage = distanceContext.createImageData(width, height);

      rows.forEach((row, y) => {
        if (!row) return;
        const left = clamp(Math.floor(row.left) - 1, 0, width - 1);
        const right = clamp(Math.ceil(row.right) + 1, 0, width - 1);
        const halfWidth = Math.max(1, (right - left) / 2);

        for (let x = left; x <= right; x += 1) {
          const offset = ((y * width) + x) * 4;
          maskImage.data[offset] = 22;
          maskImage.data[offset + 1] = 70;
          maskImage.data[offset + 2] = 255;
          maskImage.data[offset + 3] = 212;

          const normalizedDistance = clamp(Math.min(x - left, right - x) / halfWidth, 0, 1);
          const [red, green, blue] = jet(normalizedDistance);
          distanceImage.data[offset] = red;
          distanceImage.data[offset + 1] = green;
          distanceImage.data[offset + 2] = blue;
          distanceImage.data[offset + 3] = 230;
        }
      });

      maskContext.putImageData(maskImage, 0, 0);
      distanceContext.putImageData(distanceImage, 0, 0);

      const skeletonContext = skeletonCanvas.getContext('2d');
      skeletonContext.clearRect(0, 0, width, height);
      skeletonContext.beginPath();
      let started = false;
      rows.forEach((row, y) => {
        if (!row) {
          started = false;
          return;
        }
        if (!started) {
          skeletonContext.moveTo(row.center, y);
          started = true;
        } else {
          skeletonContext.lineTo(row.center, y);
        }
      });
      skeletonContext.strokeStyle = 'rgba(255, 218, 221, 0.98)';
      skeletonContext.lineWidth = 2;
      skeletonContext.lineJoin = 'round';
      skeletonContext.lineCap = 'round';
      skeletonContext.stroke();

      const candidates = [];
      for (let y = 14; y < height - 14; y += 13) {
        const row = rows[y];
        if (!row) continue;
        const left = clamp(row.left - 1, 0, width - 1);
        const right = clamp(row.right + 1, 0, width - 1);
        candidates.push({ left, right, y, width: right - left });
      }

      const scanContext = scanCanvas.getContext('2d');
      scanContext.clearRect(0, 0, width, height);
      scanContext.strokeStyle = 'rgba(255, 255, 255, 0.86)';
      scanContext.lineWidth = 1;
      candidates.forEach((candidate) => {
        scanContext.beginPath();
        scanContext.moveTo(candidate.left, candidate.y);
        scanContext.lineTo(candidate.right, candidate.y);
        scanContext.stroke();
      });

      const widest = candidates.reduce((current, candidate) => (
        !current || candidate.width > current.width ? candidate : current
      ), null);

      if (widest) {
        const maxContext = maxCanvas.getContext('2d');
        maxContext.clearRect(0, 0, width, height);
        maxContext.strokeStyle = '#ffd45a';
        maxContext.fillStyle = '#ffd45a';
        maxContext.lineWidth = 3;
        maxContext.beginPath();
        maxContext.moveTo(widest.left, widest.y);
        maxContext.lineTo(widest.right, widest.y);
        maxContext.stroke();
        [widest.left, widest.right].forEach((x) => {
          maxContext.beginPath();
          maxContext.arc(x, widest.y, 3, 0, Math.PI * 2);
          maxContext.fill();
        });
      }
    });

    source.src = '/assets/images/crack-monitoring/segmentation-reference.png';
  };

  prepareAnalysisLayers();
  updateFromScroll();

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
})();
