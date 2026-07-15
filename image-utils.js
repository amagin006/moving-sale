(function (root) {
  function imageCandidateUrl(id, n) {
    return `images/item-${id}-${n}.jpg`;
  }

  function clampedStep(current, delta, length) {
    if (length <= 0) return 0;
    const next = current + delta;
    if (next < 0) return 0;
    if (next > length - 1) return length - 1;
    return next;
  }

  function swipeDirection(deltaX, threshold) {
    threshold = threshold === undefined ? 50 : threshold;
    if (deltaX <= -threshold) return 'left';
    if (deltaX >= threshold) return 'right';
    return null;
  }

  function photoBadgeLabel(count) {
    return count > 1 ? `📷 ${count}` : null;
  }

  const ImageUtils = { imageCandidateUrl, clampedStep, swipeDirection, photoBadgeLabel };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageUtils;
  } else {
    root.ImageUtils = ImageUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
