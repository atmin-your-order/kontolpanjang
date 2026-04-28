const API_URL = '/api/videos';
const gallery = document.getElementById('gallery');
const loadMoreBtn = document.getElementById('loadMore');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('search');
const countSpan = document.getElementById('count');
const modal = document.getElementById('modal');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.querySelector('.close');

let videos = [];
let nextCursor = null;
let isLoading = false;
let activePreview = null;

// ==================== FETCH DATA ====================

async function loadVideos(cursor = null) {
  if (isLoading) return;
  isLoading = true;
  loading.classList.remove('hidden');
  loadMoreBtn.disabled = true;

  try {
    const url = new URL(API_URL, window.location.origin);
    url.searchParams.set('action', 'list');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url);
    const data = await res.json();

    if (data.videos) {
      videos.push(...data.videos);
      renderVideos(data.videos);
      updateCount();
    }

    nextCursor = data.nextCursor;
    loadMoreBtn.disabled = !nextCursor;
    loadMoreBtn.textContent = nextCursor ? 'Load More' : 'Semua video sudah dimuat';

  } catch (err) {
    console.error('Gagal load video:', err);
    loadMoreBtn.textContent = 'Error, coba lagi';
    loadMoreBtn.disabled = false;
  } finally {
    isLoading = false;
    loading.classList.add('hidden');
  }
}

// ==================== RENDER ====================

function renderVideos(videoList) {
  videoList.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.key = video.key;
    card.dataset.name = video.name;

    card.innerHTML = `
      <video muted loop preload="none" playsinline></video>
      <div class="play-icon"></div>
      <div class="info">${escapeHtml(video.name)}</div>
    `;

    // Hover: load preview 2-3 detik
    card.addEventListener('mouseenter', () => startPreview(card, video.key));
    card.addEventListener('mouseleave', () => stopPreview(card));

    // Klik: modal full player
    card.addEventListener('click', () => openModal(video));

    gallery.appendChild(card);
  });
}

// ==================== HOVER PREVIEW ====================

async function startPreview(card, key) {
  const video = card.querySelector('video');
  
  // Cuma 1 preview yang jalan
  if (activePreview && activePreview !== video) {
    stopPreview(activePreview.closest('.video-card'));
  }

  try {
    const url = await getPresignedUrl(key);
    video.src = url;
    video.load();
    
    await video.play();
    activePreview = video;

    // Stop otomatis setelah 3 detik (loop tapi user keluar = stop)
    setTimeout(() => {
      if (activePreview === video) {
        // Biarin loop, nanti mouseleave yang stop
      }
    }, 3000);

  } catch (err) {
    console.error('Preview gagal:', err);
  }
}

function stopPreview(card) {
  const video = card.querySelector('video');
  if (!video) return;
  
  video.pause();
  video.removeAttribute('src');
  video.load(); // clear buffer
  if (activePreview === video) activePreview = null;
}

// ==================== PRESIGNED URL ====================

const urlCache = new Map();

async function getPresignedUrl(key) {
  if (urlCache.has(key)) return urlCache.get(key);

  const url = new URL(API_URL, window.location.origin);
  url.searchParams.set('action', 'url');
  url.searchParams.set('key', encodeURIComponent(key));

  const res = await fetch(url);
  const data = await res.json();
  
  urlCache.set(key, data.url);
  return data.url;
}

// ==================== MODAL ====================

async function openModal(video) {
  modal.classList.remove('hidden');
  modalTitle.textContent = video.name;
  
  try {
    const url = await getPresignedUrl(video.key);
    modalVideo.src = url;
    modalVideo.load();
    modalVideo.play();
  } catch (err) {
    modalTitle.textContent = 'Gagal memuat video: ' + err.message;
  }
}

function closeModalFunc() {
  modal.classList.add('hidden');
  modalVideo.pause();
  modalVideo.removeAttribute('src');
  modalVideo.load();
}

closeModal.addEventListener('click', closeModalFunc);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModalFunc();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModalFunc();
});

// ==================== SEARCH ====================

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const cards = gallery.querySelectorAll('.video-card');
  
  cards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    card.style.display = name.includes(query) ? '' : 'none';
  });
});

// ==================== UTILS ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateCount() {
  countSpan.textContent = `(${videos.length})`;
}

// ==================== INIT ====================

loadMoreBtn.addEventListener('click', () => loadVideos(nextCursor));

// Intersection Observer: lazy load saat scroll ke bawah
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && nextCursor && !isLoading) {
      loadVideos(nextCursor);
    }
  });
}, { rootMargin: '200px' });

observer.observe(loadMoreBtn);

// Load awal
loadVideos();
