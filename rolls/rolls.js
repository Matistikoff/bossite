const albums = [
  {
    name: "Vianoce 2024",
    directory: "vianoce24",
    photos: ["000004", "000009", "000010", "000011", "000012", "000014", "000017", "000018", "000021", "000022", "000023", "000024", "000025", "000030", "000031", "000032", "000035", "000036", "000039", "000040", "000041", "audionefil", "maja", "mamka", "markMen", "nakupci", "peknaFotka", "pripravy", "pripravy2", "rodinna", "stromcek", "stromcek2", "surooo", "talir", "zavislak"],
  },
  {
    name: "Macedónsko",
    directory: "macedonsko",
    photos: ["000003", "000008", "000009", "000012", "000014", "000017", "000019", "000022", "000023", "000024", "000025", "000027", "000029", "000030", "000031", "000032", "000034", "000035", "000036", "000037", "000038", "000040", "000041", "000042", "ajHejAjNie", "chal", "chalosi", "cocaCola", "kostol", "kriz", "miestoCinu", "nasadat", "predZoo", "rdo", "rdo2", "tiene", "zadna"],
  },
];

const photos = albums.flatMap(({ name, directory, photos: albumPhotos }) =>
  albumPhotos.map((file) => ({ name, directory, file })),
);
const batchSize = 12;
let nextPhoto = 0;
let isLoading = false;
const loadedPhotos = [];

const gallery = document.querySelector("#gallery");
const sentinel = document.querySelector("#gallery-sentinel");
const dialog = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const densityInput = document.querySelector("#density");
const presentationButton = document.querySelector("#presentation");
let presentationFrame;
let lastPresentationFrame;

document.querySelector("#photo-count").textContent = `(${photos.length})`;

function thumbnailPath(photo) {
  return `../assets/images/thumbnails/${photo.directory}/${photo.file}.webp`;
}

function openPhoto(photo) {
  lightboxImage.src = `../assets/images/${photo.directory}/${photo.file}.JPG`;
  lightboxImage.alt = `${photo.name}, ${photo.file}`;
  dialog.showModal();
}

function targetRowHeight() {
  const density = Number(densityInput.value);
  return window.matchMedia("(max-width: 720px)").matches
    ? 170 - density * 1.16
    : 340 - density * 2.6;
}

function stopPresentation() {
  cancelAnimationFrame(presentationFrame);
  presentationFrame = undefined;
  lastPresentationFrame = undefined;
  presentationButton.textContent = "present";
  presentationButton.setAttribute("aria-pressed", "false");
}

function presentationScroll(timestamp) {
  if (lastPresentationFrame) {
    // About 18 pixels per second: deliberately slow enough to browse photos.
    const distance = (timestamp - lastPresentationFrame) * 0.018;
    const scrollLimit = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.min(window.scrollY + distance, scrollLimit) });
    if (window.scrollY >= scrollLimit - 1) {
      if (nextPhoto < photos.length) {
        // The first gallery batch can be shorter than the viewport. Keep the
        // presentation alive while infinite scroll supplies enough content.
        loadNextBatch();
      } else {
        stopPresentation();
        if (document.fullscreenElement) document.exitFullscreen();
        return;
      }
    }
  }
  lastPresentationFrame = timestamp;
  presentationFrame = requestAnimationFrame(presentationScroll);
}

async function togglePresentation() {
  if (presentationFrame) {
    stopPresentation();
    if (document.fullscreenElement) await document.exitFullscreen();
    return;
  }

  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    presentationButton.textContent = "stop";
    presentationButton.setAttribute("aria-pressed", "true");
    presentationFrame = requestAnimationFrame(presentationScroll);
  } catch {
    // Browsers can refuse fullscreen; the presentation can still scroll normally.
    presentationButton.textContent = "stop";
    presentationButton.setAttribute("aria-pressed", "true");
    presentationFrame = requestAnimationFrame(presentationScroll);
  }
}

function addRow(rowPhotos, height) {
  const row = document.createElement("div");
  row.className = "gallery-row";
  row.style.height = `${height}px`;

  rowPhotos.forEach((photo) => {
    const button = document.createElement("button");
    button.className = "photo";
    button.type = "button";
    button.style.flexGrow = photo.ratio;
    button.style.flexBasis = "0";
    button.setAttribute("aria-label", `Open photo from ${photo.name}`);

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
  const gap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    * (window.matchMedia("(max-width: 720px)").matches ? 0.3 : 0.45);
  const threshold = galleryWidth / rowHeight;
  let row = [];
  let rowRatio = 0;

  gallery.replaceChildren();

  loadedPhotos.forEach((photo, index) => {
    row.push(photo);
    rowRatio += photo.ratio;

    const isLastPhoto = index === loadedPhotos.length - 1;
    if (rowRatio >= threshold || (showFinalRow && isLastPhoto)) {
      const justifiedHeight = (galleryWidth - gap * (row.length - 1)) / rowRatio;
      addRow(row, Math.round(justifiedHeight));
      row = [];
      rowRatio = 0;
    }
  });
}

function preload(photo) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      ...photo,
      width: image.naturalWidth,
      height: image.naturalHeight,
      ratio: image.naturalWidth / image.naturalHeight,
    });
    image.onerror = () => resolve(null);
    image.src = thumbnailPath(photo);
  });
}

async function loadNextBatch() {
  if (isLoading || nextPhoto >= photos.length) return;
  isLoading = true;

  const batch = photos.slice(nextPhoto, nextPhoto + batchSize);
  nextPhoto += batch.length;
  const preparedPhotos = (await Promise.all(batch.map(preload))).filter(Boolean);
  loadedPhotos.push(...preparedPhotos);

  const allPhotosLoaded = nextPhoto === photos.length;
  layoutGallery(allPhotosLoaded);
  if (allPhotosLoaded) {
    sentinel.hidden = true;
    observer.disconnect();
  }
  isLoading = false;

  // IntersectionObserver only fires when its state changes. If the newly laid-out
  // gallery still ends near the viewport, explicitly continue filling it.
  if (!allPhotosLoaded) {
    requestAnimationFrame(() => {
      const sentinelTop = sentinel.getBoundingClientRect().top;
      if (sentinelTop < window.innerHeight + 600) loadNextBatch();
    });
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextBatch();
  },
  { rootMargin: "600px 0px" },
);

document.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
window.addEventListener("resize", () => layoutGallery(nextPhoto === photos.length));
densityInput.addEventListener("input", () => layoutGallery(nextPhoto === photos.length));
presentationButton.addEventListener("click", togglePresentation);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && presentationFrame) stopPresentation();
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLElement
    && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  if (event.metaKey || event.ctrlKey || event.altKey || isTyping || dialog.open) return;
  if (event.key !== "j" && event.key !== "k") return;

  event.preventDefault();
  window.scrollBy({
    top: (event.key === "j" ? 1 : -1) * Math.round(window.innerHeight * 0.7),
    behavior: "smooth",
  });
});

observer.observe(sentinel);
loadNextBatch();
