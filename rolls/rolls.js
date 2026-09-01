const batchSize = 12;
const shuttersPerRoll = 36;
const averageCostPerRoll = 20;
const rollEmojis = {
  "1_The_First": "🎞️",
  "2_Home": "🏠",
  "3_Filip_Fodbal": "⚽",
  "4_BA_Saska_Miska": "🏙️",
  "5_BW_BA": "🖤",
  "6_OkoloVianoc24": "🎄",
  "7_Chata24": "🏡",
  "8_Vianoce24": "🎄",
  "9_StefanskyVystup24": "⛰️",
  "10_OkoloVianoc24": "🎄",
  "11_Macedonsko25": "🇲🇰",
  "12_Lost": "🧭",
  "13_Lyziarsky": "⛷️",
  "14_KrojeSkate": "🛹",
  "15_Slovinsko25": "🇸🇮",
  "16_Zuberec_BA": "🏔️",
  "17_Inzinier": "🎓",
  "18_LiubovTura_Promocie": "🥾🎓",
  "19_BW2": "🖤",
  "20...32_Indonezia": "🇮🇩",
  "33_SlovinskoLiubov": "🇸🇮❤️",
  "34_Forsta25": "🎞️",
  "35_Godfather": "🤵",
  "36_LiubovBarla": "🩼",
  "37_Prve_Svate_Prijimanie": "⛪",
  "38_LiubovPraha": "🇨🇿",
  "39_Budapest": "🇭🇺",
  "40...41_Ukrajina": "🇺🇦",
  "40_Pohoda": "🎶",
  "42_Vienna": "🇦🇹",
};
let archive;
let photos = [];
let nextPhoto = 0;
let isLoading = false;
let loadedPhotos = [];
let activeMode = "rolls";
let activeFilter = "all";
let galleryVersion = 0;

const gallery = document.querySelector("#gallery");
const sentinel = document.querySelector("#gallery-sentinel");
const dialog = document.querySelector("#lightbox");
const pageTitle = document.querySelector("#page-title");
const rollYear = document.querySelector("#roll-year");
let lightboxImage = document.querySelector("#lightbox-image");
const densityInput = document.querySelector("#density");
const filterOptions = document.querySelector("#filter-options");
let isSyncingLightbox = false;
const previousButton = document.querySelector(".lightbox-previous");
const nextButton = document.querySelector(".lightbox-next");
const lightboxViewport = document.querySelector(".lightbox-viewport");
const resetZoomButton = document.querySelector(".lightbox-reset");
const frameToggleButton = document.querySelector(".lightbox-frame-toggle");
const rotateButton = document.querySelector(".lightbox-rotate");
const helpButton = document.querySelector(".lightbox-help");
const shortcutsPanel = document.querySelector("#lightbox-shortcuts");
const lightboxPreloads = new Map();
let lightboxLoadVersion = 0;
let awaitingSecondG = false;
let secondGTimeout;
const zoom = { scale: 1, x: 0, y: 0 };
let rotation = 0;
const activePointers = new Map();
let pinchStart;
let pointerStart;
let didPan = false;
let ignoreNextImageClick = false;
let lightboxCloseTimer;
let lightboxFullscreen = false;

function updateLightboxBackground(image) {
  // Use the decoded image itself so the backdrop and foreground always match.
  lightboxViewport.classList.add("has-photo-backdrop");
  lightboxViewport.style.setProperty("--lightbox-backdrop-image", `url(${JSON.stringify(image.currentSrc || image.src)})`);
}

function encodeAssetPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function thumbnailPath(photo) {
  return `../assets/images/thumbnails/${encodeURIComponent(photo.rollId)}/${encodeAssetPath(photo.file)}.webp`;
}

function openPhoto(photo, shouldUpdateUrl = true, transitionDirection = 0) {
  rotation = 0;
  resetZoom();
  const isOpening = !dialog.open;
  const path = fullImagePath(photo);
  const nextImage = lightboxPreloads.get(path) || new Image();
  const isReopeningWithDifferentPhoto = !dialog.open && nextImage !== lightboxImage;
  if (isReopeningWithDifferentPhoto) lightboxViewport.classList.add("is-loading");
  if (isReopeningWithDifferentPhoto) {
    // A closed dialog retains its last child image. Remove its source before
    // reopening so the previously viewed photo cannot flash on screen.
    lightboxPreloads.forEach((image, preloadPath) => {
      if (image === lightboxImage) lightboxPreloads.delete(preloadPath);
    });
    lightboxImage.removeAttribute("src");
    lightboxImage.alt = "";
  }
  nextImage.id = "lightbox-image";
  nextImage.alt = `${photo.rollName}, ${photo.file}`;
  // CSS's -webkit-user-drag does not disable Firefox's native image drag.
  // Preventing that drag keeps the pointer stream available for panning.
  nextImage.draggable = false;
  if (!nextImage.src) nextImage.src = path;
  lightboxPreloads.set(path, nextImage);
  const loadVersion = ++lightboxLoadVersion;
  const showImage = () => {
    if (loadVersion !== lightboxLoadVersion) return;
    if (nextImage === lightboxImage) {
      // Reopening the same cached node skips replacement, so restore the
      // backdrop that is cleared when the dialog closes.
      updateLightboxBackground(lightboxImage);
      lightboxViewport.classList.remove("is-loading");
      return;
    }
    nextImage.classList.remove("lightbox-image-open", "lightbox-image-enter-next", "lightbox-image-enter-previous");
    if (isOpening) nextImage.classList.add("lightbox-image-open");
    if (dialog.open && lightboxImage.currentSrc && transitionDirection) {
      nextImage.classList.add(transitionDirection > 0 ? "lightbox-image-enter-next" : "lightbox-image-enter-previous");
    }
    lightboxImage.replaceWith(nextImage);
    lightboxImage = nextImage;
    lightboxViewport.classList.remove("is-loading");
    updateLightboxBackground(nextImage);
    applyZoom();
  };

  if (!dialog.open) {
    clearTimeout(lightboxCloseTimer);
    dialog.classList.remove("is-closing");
    document.documentElement.classList.add("lightbox-open");
    document.body.classList.add("lightbox-open");
    dialog.showModal();
    enterLightboxFullscreen();
    // Don't let the browser's dialog focus management make the close control
    // appear active as soon as a photo opens.
    dialog.focus({ preventScroll: true });
  }
  // Keep the current image painted until the replacement has fully decoded.
  // This removes the blank frame that can otherwise appear despite a cache hit.
  if (nextImage.complete && nextImage.naturalWidth) nextImage.decode().then(showImage, showImage);
  else nextImage.addEventListener("load", () => nextImage.decode().then(showImage, showImage), { once: true });
  if (shouldUpdateUrl) updateUrl(`${photo.rollId}/${photo.file}`);
  updateLightboxNavigation(photo);
  preloadAdjacentPhotos(photo);
}

function closeLightbox() {
  if (!dialog.open || dialog.classList.contains("is-closing")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    dialog.close();
    return;
  }
  dialog.classList.add("is-closing");
  lightboxCloseTimer = window.setTimeout(() => dialog.close(), 180);
}

function clampZoomPosition() {
  const isSideways = Math.abs(rotation % 180) === 90;
  const imageWidth = (isSideways ? lightboxImage.offsetHeight : lightboxImage.offsetWidth) * zoom.scale;
  const imageHeight = (isSideways ? lightboxImage.offsetWidth : lightboxImage.offsetHeight) * zoom.scale;
  const maxX = Math.max(0, (imageWidth - lightboxViewport.clientWidth) / 2);
  const maxY = Math.max(0, (imageHeight - lightboxViewport.clientHeight) / 2);
  zoom.x = Math.max(-maxX, Math.min(maxX, zoom.x));
  zoom.y = Math.max(-maxY, Math.min(maxY, zoom.y));
}

function fitScale() {
  if (!lightboxImage.offsetWidth || !lightboxImage.offsetHeight) return 1;
  const isSideways = Math.abs(rotation % 180) === 90;
  const rotatedWidth = isSideways ? lightboxImage.offsetHeight : lightboxImage.offsetWidth;
  const rotatedHeight = isSideways ? lightboxImage.offsetWidth : lightboxImage.offsetHeight;
  return Math.min(1, (lightboxViewport.clientWidth * .98) / rotatedWidth, (lightboxViewport.clientHeight * .94) / rotatedHeight);
}

function applyZoom() {
  clampZoomPosition();
  lightboxImage.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale}) rotate(${rotation}deg)`;
  const isZoomed = zoom.scale > fitScale() + .01;
  dialog.classList.toggle("is-zoomed", isZoomed);
  lightboxViewport.classList.toggle("is-zoomed", isZoomed);
  resetZoomButton.hidden = !isZoomed;
}

function resetZoom() {
  zoom.scale = fitScale();
  zoom.x = 0;
  zoom.y = 0;
  if (lightboxImage) applyZoom();
}

function rotatePhoto() {
  // Preserve the accumulated angle so 270° → 360° animates forward instead
  // of the browser taking the shorter-looking path back to 0°.
  rotation += 90;
  zoom.scale = fitScale();
  zoom.x = 0;
  zoom.y = 0;
  applyZoom();
}

function togglePhotoFrame() {
  const frameIsVisible = !dialog.classList.toggle("without-frame");
  frameToggleButton.setAttribute("aria-label", frameIsVisible ? "Skryť rám fotografie" : "Zobraziť rám fotografie");
  frameToggleButton.title = `${frameIsVisible ? "Skryť" : "Zobraziť"} rám fotografie (B)`;
  frameToggleButton.setAttribute("aria-pressed", String(frameIsVisible));
}

function toggleShortcuts() {
  const isOpen = shortcutsPanel.hidden;
  shortcutsPanel.hidden = !isOpen;
  helpButton.setAttribute("aria-expanded", String(isOpen));
}

function closeShortcuts() {
  shortcutsPanel.hidden = true;
  helpButton.setAttribute("aria-expanded", "false");
}

async function toggleLightboxFullscreen() {
  if (!dialog.open) return;
  if (document.fullscreenElement) {
    if (lightboxFullscreen) await document.exitFullscreen();
    return;
  }
  await enterLightboxFullscreen();
}

async function enterLightboxFullscreen() {
  if (!dialog.open || document.fullscreenElement) return;
  try {
    await document.documentElement.requestFullscreen();
    lightboxFullscreen = true;
  } catch {
    // Fullscreen can be denied by the browser or unavailable in an embedded view.
  }
}

function zoomAtPoint(nextScale, clientX, clientY) {
  const viewport = lightboxViewport.getBoundingClientRect();
  const pointX = clientX - viewport.left - viewport.width / 2;
  const pointY = clientY - viewport.top - viewport.height / 2;
  const scale = Math.max(fitScale(), Math.min(8, nextScale));
  const ratio = scale / zoom.scale;
  zoom.x = pointX - (pointX - zoom.x) * ratio;
  zoom.y = pointY - (pointY - zoom.y) * ratio;
  zoom.scale = scale;
  applyZoom();
}

function pointerDistance() {
  const [first, second] = [...activePointers.values()];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function pointerMidpoint() {
  const [first, second] = [...activePointers.values()];
  return { clientX: (first.clientX + second.clientX) / 2, clientY: (first.clientY + second.clientY) / 2 };
}

function photoIndex(photo) {
  return photos.findIndex((candidate) => candidate.rollId === photo.rollId && candidate.file === photo.file);
}

function updateLightboxNavigation(photo) {
  const index = photoIndex(photo);
  previousButton.disabled = index <= 0;
  nextButton.disabled = index === -1 || index >= photos.length - 1;
}

function fullImagePath(photo) {
  return `../assets/web-images/${encodeURIComponent(photo.rollId)}/${encodeAssetPath(photo.file)}.webp`;
}

function preloadAdjacentPhotos(photo) {
  const index = photoIndex(photo);
  const adjacentPhotos = [photos[index - 1], photos[index + 1]].filter(Boolean);
  const pathsToKeep = new Set([fullImagePath(photo), ...adjacentPhotos.map(fullImagePath)]);
  adjacentPhotos.forEach((adjacentPhoto) => {
    const path = fullImagePath(adjacentPhoto);
    if (lightboxPreloads.has(path)) return;
    const image = new Image();
    image.src = path;
    lightboxPreloads.set(path, image);
    image.decode().catch(() => {});
  });
  lightboxPreloads.forEach((_, path) => {
    if (!pathsToKeep.has(path)) lightboxPreloads.delete(path);
  });
}

function navigatePhoto(direction) {
  const photo = photoFromUrl();
  const index = photo ? photoIndex(photo) : -1;
  navigateToPhoto(index + direction, direction);
}

function navigateToPhoto(index, transitionDirection = 0) {
  const nextPhoto = photos[index];
  if (!nextPhoto) return;
  openPhoto(nextPhoto, false, transitionDirection);
  updateUrl(`${nextPhoto.rollId}/${nextPhoto.file}`, true);
}

function cancelFirstG() {
  clearTimeout(secondGTimeout);
  awaitingSecondG = false;
}

function targetRowHeight() {
  const density = Number(densityInput.value);
  return window.matchMedia("(max-width: 720px)").matches ? 170 - density * 1.16 : 340 - density * 2.6;
}

function addRow(rowPhotos, height, justify = true) {
  const row = document.createElement("div");
  row.className = "gallery-row";
  row.style.height = `${height}px`;
  rowPhotos.forEach((photo) => {
    const button = document.createElement("button");
    button.className = "photo";
    button.type = "button";
    if (justify) {
      button.style.flexGrow = photo.ratio;
      button.style.flexBasis = "0";
    } else {
      button.style.flex = `0 0 ${Math.round(photo.ratio * height)}px`;
    }
    button.setAttribute("aria-label", `Otvoriť fotografiu z rollky ${photo.rollName}`);
    const image = document.createElement("img");
    image.src = thumbnailPath(photo);
    image.alt = "";
    image.width = photo.width;
    image.height = photo.height;
    image.loading = "lazy";
    image.decoding = "async";
    button.append(image);
    button.addEventListener("click", () => openPhoto(photo));
    row.append(button);
  });
  gallery.append(row);
}

function layoutGallery(showFinalRow) {
  const galleryWidth = gallery.clientWidth;
  if (!galleryWidth) return;
  const rowHeight = targetRowHeight();
  const gap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * (window.matchMedia("(max-width: 720px)").matches ? .3 : .45);
  const threshold = galleryWidth / rowHeight;
  let row = [];
  let rowRatio = 0;
  gallery.replaceChildren();
  loadedPhotos.forEach((photo, index) => {
    row.push(photo);
    rowRatio += photo.ratio;
    if (rowRatio >= threshold) {
      addRow(row, Math.round((galleryWidth - gap * (row.length - 1)) / rowRatio));
      row = [];
      rowRatio = 0;
    } else if (showFinalRow && index === loadedPhotos.length - 1) {
      addRow(row, Math.round(rowHeight), false);
    }
  });
}

function preload(photo) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ ...photo, width: image.naturalWidth, height: image.naturalHeight, ratio: image.naturalWidth / image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = thumbnailPath(photo);
  });
}

async function loadNextBatch() {
  if (isLoading || nextPhoto >= photos.length) return;
  isLoading = true;
  const version = galleryVersion;
  const batch = photos.slice(nextPhoto, nextPhoto + batchSize);
  nextPhoto += batch.length;
  const preparedPhotos = (await Promise.all(batch.map(preload))).filter(Boolean);
  if (version !== galleryVersion) {
    isLoading = false;
    loadNextBatch();
    return;
  }
  loadedPhotos.push(...preparedPhotos);
  const allPhotosLoaded = nextPhoto === photos.length;
  layoutGallery(allPhotosLoaded);
  sentinel.hidden = allPhotosLoaded;
  if (allPhotosLoaded) observer.disconnect();
  isLoading = false;
  if (!allPhotosLoaded) requestAnimationFrame(() => {
    if (sentinel.getBoundingClientRect().top < window.innerHeight + 600) loadNextBatch();
  });
}

function currentPhotos() {
  if (activeMode === "rolls") return activeFilter === "all" ? archive.photos : archive.photos.filter((photo) => photo.rollId === activeFilter);
  return activeFilter === "all" ? archive.photos : archive.photos.filter((photo) => photo.categories.includes(activeFilter));
}

function yearForRoll(roll) {
  if (roll.sortOrder <= 10) return 2024;
  if (roll.sortOrder <= 20) return 2025;
  return 2026;
}

function updatePageTitle() {
  const activeRoll = activeMode === "rolls" && activeFilter !== "all"
    ? archive.rolls.find((roll) => roll.id === activeFilter)
    : null;
  pageTitle.replaceChildren(activeRoll?.name || "Mito.Rolls");
  if (activeRoll) {
    const emoji = document.createElement("span");
    emoji.className = "roll-title-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = `\u00a0${rollEmojis[activeRoll.id] || "🎞️"}`;
    pageTitle.append(emoji);
  }
  pageTitle.classList.toggle("is-roll-title", Boolean(activeRoll));
  rollYear.textContent = activeRoll
    ? yearForRoll(activeRoll)
    : Math.max(...archive.rolls.map(yearForRoll));
}

function setActiveMode(mode) {
  activeMode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    const selected = button.dataset.mode === mode;
    const visuallyActive = selected && (mode !== "rolls" || activeFilter === "all");
    button.classList.toggle("is-active", visuallyActive);
    button.setAttribute("aria-selected", String(selected));
  });
}

function selectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rollId = params.get("roll");
  const subjectId = params.get("subject");

  if (rollId && archive.rolls.some((roll) => roll.id === rollId)) {
    return { mode: "rolls", filter: rollId };
  }
  if (subjectId && archive.categories.some((category) => category.id === subjectId)) {
    return { mode: "subjects", filter: subjectId };
  }
  return { mode: "rolls", filter: "all" };
}

function photoFromUrl() {
  const photoId = new URLSearchParams(window.location.search).get("photo");
  if (!photoId) return null;
  const [rollId, ...fileParts] = photoId.split("/");
  const file = fileParts.join("/");
  if (!rollId || !file) return null;
  return archive.photos.find((photo) => photo.rollId === rollId && photo.file === file) || null;
}

function updateUrl(photoId = null, shouldReplace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("roll");
  url.searchParams.delete("subject");
  url.searchParams.delete("photo");
  if (activeFilter !== "all") url.searchParams.set(activeMode === "rolls" ? "roll" : "subject", activeFilter);
  if (photoId) url.searchParams.set("photo", photoId);
  const state = photoId ? { lightbox: true } : null;
  if (shouldReplace) history.replaceState(state, "", url);
  else history.pushState(state, "", url);
}

function syncLightboxWithUrl() {
  const photo = photoFromUrl();
  isSyncingLightbox = true;
  if (photo) openPhoto(photo, false);
  else if (dialog.open) closeLightbox();
  isSyncingLightbox = false;
}

function renderFilterOptions() {
  const createFilterButton = ({ id, label, emoji }) => {
    const button = document.createElement("button");
    button.className = `filter-button${emoji ? " has-emoji" : ""}${id === activeFilter ? " is-active" : ""}`;
    button.type = "button";
    const labelText = document.createElement("span");
    labelText.textContent = label;
    button.append(labelText);
    if (emoji) {
      const emojiText = document.createElement("span");
      emojiText.className = "filter-emoji";
      emojiText.setAttribute("aria-hidden", "true");
      emojiText.textContent = emoji;
      button.append(emojiText);
    }
    button.addEventListener("click", () => selectFilter(id, true));
    return button;
  };

  filterOptions.classList.toggle("is-roll-list", activeMode === "rolls");
  if (activeMode === "subjects") {
    filterOptions.replaceChildren(...archive.categories.map(createFilterButton));
    return;
  }

  const rollsByYear = new Map([[2026, []], [2025, []], [2024, []]]);
  [...archive.rolls]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((roll) => rollsByYear.get(yearForRoll(roll)).push({
      id: roll.id,
      label: roll.name,
      emoji: rollEmojis[roll.id] || "🎞️",
    }));

  const rows = [...rollsByYear].map(([year, rolls]) => {
    const row = document.createElement("div");
    row.className = "filter-year-row";

    const yearBadge = document.createElement("span");
    yearBadge.className = "filter-year-badge";
    yearBadge.textContent = year;

    row.append(yearBadge, ...rolls.map(createFilterButton));
    return row;
  });
  filterOptions.replaceChildren(...rows);
}

function selectFilter(filter, shouldUpdateUrl = false) {
  galleryVersion += 1;
  activeFilter = filter;
  setActiveMode(activeMode);
  updatePageTitle();
  photos = currentPhotos();
  nextPhoto = 0;
  loadedPhotos = [];
  gallery.replaceChildren();
  sentinel.hidden = false;
  observer.observe(sentinel);
  renderFilterOptions();
  loadNextBatch();
  if (shouldUpdateUrl) updateUrl();
}

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) loadNextBatch();
}, { rootMargin: "600px 0px" });

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveMode(button.dataset.mode);
    activeFilter = "all";
    selectFilter("all", true);
  });
});

window.addEventListener("popstate", () => {
  const selection = selectionFromUrl();
  if (selection.mode !== activeMode || selection.filter !== activeFilter) {
    setActiveMode(selection.mode);
    selectFilter(selection.filter);
  }
  syncLightboxWithUrl();
});

document.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
previousButton.addEventListener("click", () => navigatePhoto(-1));
nextButton.addEventListener("click", () => navigatePhoto(1));
resetZoomButton.addEventListener("click", resetZoom);
frameToggleButton.addEventListener("click", togglePhotoFrame);
rotateButton.addEventListener("click", rotatePhoto);
helpButton.addEventListener("click", toggleShortcuts);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeLightbox(); });
document.addEventListener("click", (event) => {
  if (!shortcutsPanel.hidden && !helpButton.contains(event.target) && !shortcutsPanel.contains(event.target)) closeShortcuts();
});
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLightbox();
});
lightboxViewport.addEventListener("click", (event) => {
  // Pointer capture used for panning can retarget a click to the viewport.
  if (event.target !== lightboxImage && event.target !== lightboxViewport) return;
  if (ignoreNextImageClick || didPan) {
    ignoreNextImageClick = false;
    didPan = false;
    return;
  }
  const viewport = lightboxViewport.getBoundingClientRect();
  if (zoom.scale > fitScale() + .01) resetZoom();
  else zoomAtPoint(2, viewport.left + viewport.width / 2, viewport.top + viewport.height / 2);
});
lightboxViewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  const multiplier = Math.exp(-event.deltaY * .002);
  zoomAtPoint(zoom.scale * multiplier, event.clientX, event.clientY);
}, { passive: false });
lightboxViewport.addEventListener("dragstart", (event) => event.preventDefault());
lightboxViewport.addEventListener("pointerdown", (event) => {
  if (event.target !== lightboxImage) return;
  lightboxViewport.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, event);
  if (activePointers.size === 2) {
    pinchStart = { distance: pointerDistance(), scale: zoom.scale };
    pointerStart = null;
    ignoreNextImageClick = true;
  } else {
    pointerStart = { clientX: event.clientX, clientY: event.clientY, x: zoom.x, y: zoom.y };
    didPan = false;
  }
});
lightboxViewport.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, event);
  if (activePointers.size === 2 && pinchStart) {
    const midpoint = pointerMidpoint();
    zoomAtPoint(pinchStart.scale * (pointerDistance() / pinchStart.distance), midpoint.clientX, midpoint.clientY);
    return;
  }
  if (!pointerStart || zoom.scale <= fitScale() + .01) return;
  const x = pointerStart.x + event.clientX - pointerStart.clientX;
  const y = pointerStart.y + event.clientY - pointerStart.clientY;
  didPan ||= Math.hypot(x - pointerStart.x, y - pointerStart.y) > 3;
  zoom.x = x;
  zoom.y = y;
  lightboxViewport.classList.toggle("is-panning", didPan);
  applyZoom();
});
function releasePointer(event) {
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) pinchStart = null;
  if (!activePointers.size) {
    pointerStart = null;
    lightboxViewport.classList.remove("is-panning");
  }
}
lightboxViewport.addEventListener("pointerup", releasePointer);
lightboxViewport.addEventListener("pointercancel", releasePointer);
dialog.addEventListener("close", () => {
  clearTimeout(lightboxCloseTimer);
  dialog.classList.remove("is-closing");
  lightboxLoadVersion += 1;
  activePointers.clear();
  lightboxViewport.classList.remove("has-photo-backdrop");
  lightboxViewport.classList.remove("is-loading");
  lightboxViewport.style.removeProperty("--lightbox-backdrop-image");
  closeShortcuts();
  resetZoom();
  if (lightboxFullscreen && document.fullscreenElement) document.exitFullscreen();
  document.documentElement.classList.remove("lightbox-open");
  document.body.classList.remove("lightbox-open");
  if (isSyncingLightbox || !new URLSearchParams(window.location.search).has("photo")) return;
  if (history.state?.lightbox) history.back();
  else updateUrl(null, true);
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) lightboxFullscreen = false;
});
window.addEventListener("resize", () => {
  layoutGallery(nextPhoto === photos.length);
  if (dialog.open) applyZoom();
});
densityInput.addEventListener("input", () => layoutGallery(nextPhoto === photos.length));
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  if (event.metaKey || event.ctrlKey || event.altKey || isTyping) return;
  if (dialog.open && ["ArrowLeft", "ArrowRight", "h", "j", "k", "l"].includes(event.key)) {
    event.preventDefault();
    cancelFirstG();
    navigatePhoto(["ArrowLeft", "h", "j"].includes(event.key) ? -1 : 1);
    return;
  }
  if (dialog.open && event.key === "G") {
    event.preventDefault();
    cancelFirstG();
    navigateToPhoto(photos.length - 1);
    return;
  }
  if (dialog.open && event.key === "0") {
    event.preventDefault();
    resetZoom();
    return;
  }
  if (dialog.open && event.key.toLowerCase() === "r") {
    event.preventDefault();
    rotatePhoto();
    return;
  }
  if (dialog.open && event.key.toLowerCase() === "b") {
    event.preventDefault();
    togglePhotoFrame();
    return;
  }
  if (dialog.open && event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleLightboxFullscreen();
    return;
  }
  if (dialog.open && (event.key === "+" || event.key === "=" || event.key === "-")) {
    event.preventDefault();
    const viewport = lightboxViewport.getBoundingClientRect();
    zoomAtPoint(zoom.scale * (event.key === "-" ? .8 : 1.25), viewport.left + viewport.width / 2, viewport.top + viewport.height / 2);
    return;
  }
  if (dialog.open && event.key === "g" && !event.repeat) {
    event.preventDefault();
    if (awaitingSecondG) {
      cancelFirstG();
      navigateToPhoto(0);
    } else {
      awaitingSecondG = true;
      secondGTimeout = window.setTimeout(() => { awaitingSecondG = false; }, 1000);
    }
    return;
  }
  cancelFirstG();
  if (dialog.open || (event.key !== "j" && event.key !== "k")) return;
  event.preventDefault();
  window.scrollBy({ top: (event.key === "j" ? 1 : -1) * Math.round(window.innerHeight * .7), behavior: "smooth" });
});

if (!window.ROLLS_ARCHIVE) {
  sentinel.hidden = true;
  gallery.textContent = "Údaje archívu sa nepodarilo načítať.";
} else {
  archive = {
    ...window.ROLLS_ARCHIVE,
    rolls: window.ROLLS_ARCHIVE.rolls.slice().sort((a, b) => b.sortOrder - a.sortOrder),
  };
  archive.photos = archive.rolls.flatMap((roll) => roll.photos.map((photo) => ({ ...photo, rollId: roll.id, rollName: roll.name })));
  const rollCount = archive.rolls.reduce((total, roll) => total + (roll.rollCount || 1), 0);
  document.querySelector("#roll-count").textContent = `(${rollCount})`;
  document.querySelector("#shutter-count").textContent = `(${rollCount * shuttersPerRoll})`;
  document.querySelector("#film-cost").textContent = `€${(averageCostPerRoll * rollCount).toFixed(2)}`;
  const selection = selectionFromUrl();
  setActiveMode(selection.mode);
  renderFilterOptions();
  selectFilter(selection.filter);
  syncLightboxWithUrl();
}
