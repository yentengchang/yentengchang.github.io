(() => {
  'use strict';

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const getClusters = (values) => {
    if (!values.length) return [];
    const clusters = [[values[0]]];

    for (let index = 1; index < values.length; index += 1) {
      const cluster = clusters[clusters.length - 1];
      if (values[index] - cluster[cluster.length - 1] <= 2) {
        cluster.push(values[index]);
      } else {
        clusters.push([values[index]]);
      }
    }

    return clusters;
  };

  const jet = (value) => {
    const red = clamp(1.5 - Math.abs((4 * value) - 3), 0, 1);
    const green = clamp(1.5 - Math.abs((4 * value) - 2), 0, 1);
    const blue = clamp(1.5 - Math.abs((4 * value) - 1), 0, 1);
    return [Math.round(red * 255), Math.round(green * 255), Math.round(blue * 255)];
  };

  const prepareArchitectureFilters = () => {
    const buttons = [...document.querySelectorAll('[data-architecture-filter]')];
    const elements = [...document.querySelectorAll('[data-path-tags]')];
    if (!buttons.length || !elements.length) return;

    const selectFilter = (filter) => {
      buttons.forEach((button) => {
        const active = button.dataset.architectureFilter === filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      elements.forEach((element) => {
        const tags = (element.dataset.pathTags || '').split(/\s+/);
        element.classList.toggle('is-dim', filter !== 'all' && !tags.includes(filter));
      });
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => selectFilter(button.dataset.architectureFilter));
    });
  };

  const prepareLensComparison = () => {
    document.querySelectorAll('[data-lens-comparison]').forEach((comparison) => {
      const input = comparison.querySelector('input[type="range"]');
      if (!input) return;
      const update = () => comparison.style.setProperty('--split', `${input.value}%`);
      input.addEventListener('input', update);
      update();
    });
  };

  const renderEventDataSeries = () => {
    const lengthPath = document.querySelector('.event-series-length');
    const widthPath = document.querySelector('.event-series-width');
    if (!lengthPath || !widthPath) return;

    const sampleCount = 361;
    const rawNoise = [];
    let seed = 27463;

    for (let index = 0; index < sampleCount + 8; index += 1) {
      seed = (seed * 16807) % 2147483647;
      rawNoise.push(((seed / 2147483647) * 2) - 1);
    }

    const filteredNoise = rawNoise.map((_, index) => {
      const a = rawNoise[Math.max(0, index - 2)];
      const b = rawNoise[Math.max(0, index - 1)];
      const c = rawNoise[index];
      const d = rawNoise[Math.min(rawNoise.length - 1, index + 1)];
      const e = rawNoise[Math.min(rawNoise.length - 1, index + 2)];
      return (a + (2 * b) + (3 * c) + (2 * d) + e) / 9;
    });

    const sigmoid = (value, center, steepness = 65) => 1 / (1 + Math.exp(-steepness * (value - center)));
    const gaussian = (value, center, spread) => Math.exp(-Math.pow((value - center) / spread, 2));
    const xAt = (time) => 130 + (950 * time);
    const lengthY = (value) => 300 - (((value - 49.78) / 0.24) * 180);
    const widthY = (value) => 565 - (((value - 1.48) / 0.16) * 180);
    const points = Array.from({ length: sampleCount }, (_, index) => index / (sampleCount - 1));

    const lengthValues = points.map((time, index) => {
      const noise = filteredNoise[index + 3];
      if (time < 0.3) {
        return 49.82 + (0.0018 * Math.sin(2 * Math.PI * ((4.2 * time) + 0.1))) + (0.0015 * noise);
      }

      if (time <= 0.75) {
        const eventTime = (time - 0.3) / 0.45;
        const growth =
          (0.018 * sigmoid(eventTime, 0.17)) +
          (0.043 * sigmoid(eventTime, 0.35)) +
          (0.052 * sigmoid(eventTime, 0.55)) +
          (0.036 * sigmoid(eventTime, 0.73)) +
          (0.019 * sigmoid(eventTime, 0.88));
        const activity =
          (0.36 * gaussian(eventTime, 0.24, 0.16)) +
          gaussian(eventTime, 0.55, 0.2) +
          (0.42 * gaussian(eventTime, 0.82, 0.16));
        const measurementVariation =
          ((0.0014 + (0.0036 * activity)) * noise) +
          (0.0018 * activity * Math.sin(2 * Math.PI * ((13.4 * eventTime) + (0.8 * eventTime * eventTime))));
        return 49.82 + growth + measurementVariation;
      }

      const postTime = (time - 0.75) / 0.25;
      return 49.988 +
        (0.0025 * Math.exp(-7 * postTime) * Math.sin(2 * Math.PI * 8.5 * postTime)) +
        (0.0013 * noise);
    });

    const widthValues = points.map((time, index) => {
      const noise = filteredNoise[index + 5];
      if (time < 0.3) {
        return 1.54 + (0.0015 * Math.sin(2 * Math.PI * ((4.8 * time) + 0.18))) + (0.0012 * noise);
      }

      if (time <= 0.75) {
        const eventTime = (time - 0.3) / 0.45;
        const activity =
          (0.38 * gaussian(eventTime, 0.2, 0.14)) +
          gaussian(eventTime, 0.51, 0.2) +
          (0.48 * gaussian(eventTime, 0.8, 0.17));
        const carrier =
          (0.48 * Math.sin(2 * Math.PI * ((9.1 * eventTime) + (1.1 * eventTime * eventTime)) + 0.3)) +
          (0.27 * Math.sin(2 * Math.PI * ((15.7 * eventTime) + (0.55 * eventTime * eventTime)) + 1.35)) +
          (0.16 * Math.sin(2 * Math.PI * (24.3 * eventTime) + 2.2)) +
          (0.18 * noise);
        const residualOpening = 0.032 * sigmoid(eventTime, 0.57, 18);
        return 1.54 + residualOpening + ((0.005 + (0.054 * activity)) * carrier);
      }

      const postTime = (time - 0.75) / 0.25;
      const ringdown =
        (0.0085 * Math.exp(-6.5 * postTime) * Math.sin(2 * Math.PI * 9.5 * postTime + 0.35)) +
        (0.0035 * Math.exp(-8 * postTime) * Math.sin(2 * Math.PI * 18.5 * postTime + 1.1));
      return 1.572 + ringdown + (0.0012 * noise);
    });

    const toPath = (values, yScale) => values.map((value, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command}${xAt(points[index]).toFixed(2)} ${yScale(value).toFixed(2)}`;
    }).join(' ');

    lengthPath.setAttribute('d', toPath(lengthValues, lengthY));
    widthPath.setAttribute('d', toPath(widthValues, widthY));
  };

  const prepareEventDataFigures = () => {
    const figures = [...document.querySelectorAll('[data-event-data-figure]')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!figures.length || reducedMotion) return;

    figures.forEach((figure) => figure.classList.add('is-animated'));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

      figures.forEach((figure) => observer.observe(figure));
      return;
    }

    let pendingFigures = figures;
    let frameRequested = false;

    const scan = () => {
      frameRequested = false;
      pendingFigures = pendingFigures.filter((figure) => {
        const bounds = figure.getBoundingClientRect();
        const visible = bounds.top < window.innerHeight * 0.88 && bounds.bottom > window.innerHeight * 0.12;
        if (visible) figure.classList.add('is-visible');
        return !visible;
      });

      if (!pendingFigures.length) {
        window.removeEventListener('scroll', requestScan);
        window.removeEventListener('resize', requestScan);
      }
    };

    const requestScan = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(scan);
    };

    window.addEventListener('scroll', requestScan, { passive: true });
    window.addEventListener('resize', requestScan);
    requestScan();
  };

  const prepareMeasurementLayers = () => {
    const maskCanvases = [...document.querySelectorAll('[data-technical-layer="mask"]')];
    const skeletonCanvases = [...document.querySelectorAll('[data-technical-layer="skeleton"]')];
    const distanceCanvases = [...document.querySelectorAll('[data-technical-layer="distance"]')];
    const scanCanvases = [...document.querySelectorAll('[data-technical-layer="scan"]')];
    const maximumCanvases = [...document.querySelectorAll('[data-technical-layer="maximum"]')];
    const referenceCanvas = maskCanvases[0] || distanceCanvases[0];
    if (!referenceCanvas) return;

    const width = referenceCanvas.width;
    const height = referenceCanvas.height;
    const source = new Image();

    source.addEventListener('load', () => {
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });

      // Crop the camera-image region from the actual v1 result screenshot.
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
          const segmentationBlue = blue > 105 && blue - red > 28 && blue - green > 16;

          if (segmentationBlue) {
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
          for (const column of straightColumns) {
            if (Math.abs(column - x) <= 2) return false;
          }
          if (y < 17 && x < 240) return false;
          return true;
        });
        const clusters = getClusters(cleaned).filter((cluster) => cluster.length >= 2);
        if (!clusters.length) continue;

        const ranked = clusters.map((cluster) => {
          const left = cluster[0];
          const right = cluster[cluster.length - 1];
          const center = (left + right) / 2;
          const continuity = previousCenter === null ? 0 : Math.abs(center - previousCenter);
          return { left, right, center, score: cluster.length - (continuity * 1.4) };
        });

        ranked.sort((a, b) => {
          if (previousCenter === null) return (b.right - b.left) - (a.right - a.left);
          return b.score - a.score;
        });

        const selected = previousCenter === null
          ? ranked[0]
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

      const paintMask = (canvas) => {
        const context = canvas.getContext('2d');
        const image = context.createImageData(width, height);
        rows.forEach((row, y) => {
          if (!row) return;
          const left = clamp(Math.floor(row.left) - 1, 0, width - 1);
          const right = clamp(Math.ceil(row.right) + 1, 0, width - 1);
          for (let x = left; x <= right; x += 1) {
            const offset = ((y * width) + x) * 4;
            image.data[offset] = 22;
            image.data[offset + 1] = 70;
            image.data[offset + 2] = 255;
            image.data[offset + 3] = 205;
          }
        });
        context.putImageData(image, 0, 0);
      };

      const paintSkeleton = (canvas) => {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.beginPath();
        let started = false;
        rows.forEach((row, y) => {
          if (!row) {
            started = false;
            return;
          }
          if (!started) {
            context.moveTo(row.center, y);
            started = true;
          } else {
            context.lineTo(row.center, y);
          }
        });
        context.strokeStyle = '#ff375f';
        context.lineWidth = 2.4;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.stroke();
      };

      const paintDistance = (canvas) => {
        const context = canvas.getContext('2d');
        const image = context.createImageData(width, height);
        rows.forEach((row, y) => {
          if (!row) return;
          const left = clamp(Math.floor(row.left) - 1, 0, width - 1);
          const right = clamp(Math.ceil(row.right) + 1, 0, width - 1);
          const halfWidth = Math.max(1, (right - left) / 2);
          for (let x = left; x <= right; x += 1) {
            const offset = ((y * width) + x) * 4;
            const normalizedDistance = clamp(Math.min(x - left, right - x) / halfWidth, 0, 1);
            const [red, green, blue] = jet(normalizedDistance);
            image.data[offset] = red;
            image.data[offset + 1] = green;
            image.data[offset + 2] = blue;
            image.data[offset + 3] = 230;
          }
        });
        context.putImageData(image, 0, 0);
      };

      const candidates = [];
      for (let y = 14; y < height - 14; y += 13) {
        const row = rows[y];
        if (!row) continue;
        const left = clamp(row.left - 1, 0, width - 1);
        const right = clamp(row.right + 1, 0, width - 1);
        candidates.push({ left, right, y, width: right - left });
      }

      const paintScan = (canvas) => {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.lineWidth = 1;
        candidates.forEach((candidate) => {
          context.beginPath();
          context.moveTo(candidate.left, candidate.y);
          context.lineTo(candidate.right, candidate.y);
          context.stroke();
        });
      };

      const widest = candidates.reduce((current, candidate) => (
        !current || candidate.width > current.width ? candidate : current
      ), null);

      const paintMaximum = (canvas) => {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        if (!widest) return;
        context.strokeStyle = '#ffd60a';
        context.fillStyle = '#ffd60a';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(widest.left, widest.y);
        context.lineTo(widest.right, widest.y);
        context.stroke();
        [widest.left, widest.right].forEach((x) => {
          context.beginPath();
          context.arc(x, widest.y, 3.2, 0, Math.PI * 2);
          context.fill();
        });
      };

      maskCanvases.forEach(paintMask);
      skeletonCanvases.forEach(paintSkeleton);
      distanceCanvases.forEach(paintDistance);
      scanCanvases.forEach(paintScan);
      maximumCanvases.forEach(paintMaximum);
    });

    source.src = '/assets/images/crack-monitoring/segmentation-reference.png';
  };

  prepareArchitectureFilters();
  prepareLensComparison();
  renderEventDataSeries();
  prepareEventDataFigures();
  prepareMeasurementLayers();
})();
