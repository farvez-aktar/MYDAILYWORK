/* ================================================================
   FaceAI – script.js
   Handles: tabs, drag-drop upload, detect API, webcam stream,
            enroll, database management, particles, toast
   ================================================================ */

/* ── Utility ── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function showToast(msg, type = 'info', duration = 3500) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

/* ── Client Camera Streams & Helpers ── */
let detectCameraStream = null;
let enrollCameraStream = null;

async function startClientCamera(videoEl, placeholderEl, streamSetter) {
  if (!videoEl || !placeholderEl) return;
  placeholderEl.hidden = false;
  placeholderEl.innerHTML = '<div class="spinner"></div><p>Initializing camera...</p>';
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    });
    
    // Set event listener BEFORE setting srcObject to avoid race conditions
    videoEl.onloadedmetadata = () => {
      placeholderEl.hidden = true;
      videoEl.play().catch(e => console.error("Error playing video:", e));
    };
    
    videoEl.srcObject = stream;
    streamSetter(stream);
  } catch (err) {
    console.error("Camera access error:", err);
    placeholderEl.innerHTML = `<span style="font-size:2rem;color:var(--danger)">⚠</span><p style="margin-top:0.5rem;">Camera access denied or unavailable</p>`;
    showToast('Failed to access camera. Check permissions.', 'error');
  }
}

function stopClientCamera(videoEl, streamGetter, streamSetter) {
  const stream = streamGetter();
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  if (videoEl) {
    videoEl.pause();
    videoEl.srcObject = null;
  }
  streamSetter(null);
}

function stopAllClientCameras() {
  stopClientCamera($('#detect-video'), () => detectCameraStream, (s) => { detectCameraStream = s; });
  stopClientCamera($('#enroll-video'), () => enrollCameraStream, (s) => { enrollCameraStream = s; });
}

/* ================================================================
   PARTICLES BACKGROUND
   ================================================================ */
(function initParticles() {
  const canvas = $('#particles-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function Particle() {
    this.reset = function () {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.4 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.a  = Math.random() * 0.5 + 0.1;
    };
    this.reset();
    this.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    };
    this.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${this.a})`;
      ctx.fill();
    };
  }

  particles = Array.from({ length: 110 }, () => new Particle());

  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - d / 120)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ================================================================
   TABS
   ================================================================ */
function resetSourceToggles() {
  const detectUpload = $('#detect-source-upload');
  const detectCam = $('#detect-source-camera');
  const drop = $('#drop-zone');
  const detectCamCont = $('#detect-camera-container');
  const dBtn = $('#detect-btn');

  if (detectUpload) detectUpload.classList.add('active');
  if (detectCam) detectCam.classList.remove('active');
  if (drop) drop.hidden = false;
  if (detectCamCont) detectCamCont.hidden = true;
  if (dBtn) dBtn.disabled = !selectedFile;

  const enrollUpload = $('#enroll-source-upload');
  const enrollCam = $('#enroll-source-camera');
  const enrollDr = $('#enroll-drop');
  const enrollCamCont = $('#enroll-camera-container');
  const eBtn = $('#enroll-btn');

  if (enrollUpload) enrollUpload.classList.add('active');
  if (enrollCam) enrollCam.classList.remove('active');
  if (enrollDr) enrollDr.hidden = false;
  if (enrollCamCont) enrollCamCont.hidden = true;
  if (eBtn) eBtn.disabled = !enrollSelectedFile;
}

$$('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    // If switching away from webcam stream tab, stop the server webcam
    const activeTab = $('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'webcam') {
      await stopServerWebcam();
    }

    // Stop client cameras when switching tabs
    stopAllClientCameras();

    // Reset source toggles to default Upload mode
    resetSourceToggles();

    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#panel-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'database') loadDatabase();
  });
});

/* ================================================================
   STATS BAR refresh
   ================================================================ */
async function refreshStats() {
  try {
    const res = await fetch('/api/database');
    const data = await res.json();
    $('#stat-total').textContent = data.total ?? 0;
  } catch (_) {}
}
refreshStats();

/* ================================================================
   IMAGE DETECTION TAB
   ================================================================ */
const dropZone   = $('#drop-zone');
const fileInput  = $('#file-input');
const browseBtn  = $('#browse-btn');
const detectBtn  = $('#detect-btn');
const resultWrap = $('#result-wrap');
const resultInfo = $('#result-info');
let selectedFile = null;

// Camera source controls
const detectSourceUpload = $('#detect-source-upload');
const detectSourceCamera = $('#detect-source-camera');
const detectCameraContainer = $('#detect-camera-container');
const detectVideo = $('#detect-video');
const detectCameraPlaceholder = $('#detect-camera-placeholder');
const detectCaptureBtn = $('#detect-capture-btn');

detectSourceUpload.addEventListener('click', () => {
  detectSourceUpload.classList.add('active');
  detectSourceCamera.classList.remove('active');
  dropZone.hidden = false;
  detectCameraContainer.hidden = true;
  stopClientCamera(detectVideo, () => detectCameraStream, (s) => { detectCameraStream = s; });
  detectBtn.disabled = !selectedFile;
});

detectSourceCamera.addEventListener('click', async () => {
  detectSourceCamera.classList.add('active');
  detectSourceUpload.classList.remove('active');
  dropZone.hidden = true;
  detectCameraContainer.hidden = false;
  detectBtn.disabled = true;
  
  // Ensure server webcam is stopped first to avoid lock
  await stopServerWebcam();
  
  startClientCamera(detectVideo, detectCameraPlaceholder, (s) => { detectCameraStream = s; });
});

detectCaptureBtn.addEventListener('click', () => {
  if (!detectCameraStream) {
    showToast('Camera is not active.', 'error');
    return;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = detectVideo.videoWidth || 640;
  canvas.height = detectVideo.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  
  // Capture un-mirrored view
  ctx.drawImage(detectVideo, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('Failed to capture image.', 'error');
      return;
    }
    selectedFile = new File([blob], 'webcam_capture.jpg', { type: 'image/jpeg' });
    detectBtn.disabled = false;
    
    // Display captured preview
    const url = URL.createObjectURL(blob);
    resultWrap.innerHTML = `<img src="${url}" alt="Capture Preview" style="max-height:380px;object-fit:contain;width:100%">`;
    resultInfo.hidden = true;
    showToast('Photo captured! Click "Detect Faces" to analyze.', 'success');
  }, 'image/jpeg', 0.95);
});

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', 'error');
    return;
  }
  selectedFile = file;
  detectBtn.disabled = false;
  // Show preview
  const reader = new FileReader();
  reader.onload = e => {
    resultWrap.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-height:380px;object-fit:contain;width:100%">`;
  };
  reader.readAsDataURL(file);
  resultInfo.hidden = true;
  showToast(`Loaded: ${file.name}`, 'success');
}

detectBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Show spinner
  resultWrap.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> Detecting faces…</div>`;
  detectBtn.disabled = true;

  const fd = new FormData();
  fd.append('image', selectedFile);
  fd.append('recognition', $('#recog-toggle').checked ? 'true' : 'false');

  try {
    const res  = await fetch('/api/detect', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.error) {
      showToast(data.error, 'error');
      resultWrap.innerHTML = `<div class="placeholder-msg"><span class="placeholder-icon">⚠</span><p>${data.error}</p></div>`;
      return;
    }

    // Show annotated image
    resultWrap.innerHTML = `<img src="data:image/jpeg;base64,${data.annotated_b64}" alt="Detection result" style="max-height:380px;object-fit:contain;width:100%">`;

    // Face list
    const summary = `${data.face_count} face(s) detected${data.recognition ? ' with recognition' : ''}`;
    $('#result-summary').textContent = summary;

    const list = $('#faces-list');
    list.innerHTML = data.faces.map(f => `
      <div class="face-item">
        <div class="face-id">${f.id}</div>
        <span class="face-name">${f.name || 'Face'}</span>
        <span class="face-conf">${(f.confidence * 100).toFixed(0)}%</span>
      </div>`).join('');

    resultInfo.hidden = false;
    showToast(summary, 'success');

  } catch (err) {
    showToast('Detection failed – is the server running?', 'error');
    console.error(err);
  } finally {
    detectBtn.disabled = false;
  }
});

/* ================================================================
   WEBCAM TAB
   ================================================================ */
const startCamBtn      = $('#start-cam-btn');
const stopCamBtn       = $('#stop-cam-btn');
const webcamStream     = $('#webcam-stream');
const webcamPlaceholder = $('#webcam-placeholder');
const webcamOverlay    = $('#webcam-overlay');
let statsInterval      = null;

async function stopServerWebcam() {
  webcamStream.src = '';
  webcamStream.hidden = true;
  webcamPlaceholder.hidden = false;
  webcamOverlay.hidden = true;
  startCamBtn.disabled = false;
  stopCamBtn.disabled  = true;
  
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  $('#stat-fps').textContent   = '—';
  $('#stat-faces').textContent = '—';
  try {
    await fetch('/api/webcam/stop', { method: 'POST' });
  } catch (_) {}
}

startCamBtn.addEventListener('click', () => {
  // Stop client-side cameras first to avoid conflicts
  stopAllClientCameras();

  webcamStream.src = '/video_feed';
  webcamStream.hidden = false;
  webcamPlaceholder.hidden = true;
  webcamOverlay.hidden = false;
  startCamBtn.disabled = true;
  stopCamBtn.disabled  = false;

  statsInterval = setInterval(async () => {
    try {
      const res  = await fetch('/api/webcam/stats');
      const data = await res.json();
      $('#badge-fps').textContent   = `${data.fps} FPS`;
      $('#badge-faces').textContent = `${data.face_count} Faces`;
      $('#stat-fps').textContent    = data.fps;
      $('#stat-faces').textContent  = data.face_count;
    } catch (_) {}
  }, 1000);
});

stopCamBtn.addEventListener('click', stopServerWebcam);

/* ================================================================
   ENROLL TAB
   ================================================================ */
const enrollDrop    = $('#enroll-drop');
const enrollFile    = $('#enroll-file');
const enrollBrowse  = $('#enroll-browse');
const enrollPreview = $('#enroll-preview');
const enrollPreviewWrap = $('#enroll-preview-wrap');
const enrollBtn     = $('#enroll-btn');
const enrollStatus  = $('#enroll-status');
let enrollSelectedFile = null;

// Camera source controls for Enroll
const enrollSourceUpload = $('#enroll-source-upload');
const enrollSourceCamera = $('#enroll-source-camera');
const enrollCameraContainer = $('#enroll-camera-container');
const enrollVideo = $('#enroll-video');
const enrollCameraPlaceholder = $('#enroll-camera-placeholder');
const enrollCaptureBtn = $('#enroll-capture-btn');

enrollSourceUpload.addEventListener('click', () => {
  enrollSourceUpload.classList.add('active');
  enrollSourceCamera.classList.remove('active');
  enrollDrop.hidden = false;
  enrollCameraContainer.hidden = true;
  stopClientCamera(enrollVideo, () => enrollCameraStream, (s) => { enrollCameraStream = s; });
  enrollBtn.disabled = !enrollSelectedFile;
});

enrollSourceCamera.addEventListener('click', async () => {
  enrollSourceCamera.classList.add('active');
  enrollSourceUpload.classList.remove('active');
  enrollDrop.hidden = true;
  enrollCameraContainer.hidden = false;
  enrollBtn.disabled = true;
  
  // Ensure server webcam is stopped first to avoid lock
  await stopServerWebcam();
  
  startClientCamera(enrollVideo, enrollCameraPlaceholder, (s) => { enrollCameraStream = s; });
});

enrollCaptureBtn.addEventListener('click', () => {
  if (!enrollCameraStream) {
    showToast('Camera is not active.', 'error');
    return;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = enrollVideo.videoWidth || 640;
  canvas.height = enrollVideo.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  
  // Capture un-mirrored view
  ctx.drawImage(enrollVideo, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('Failed to capture image.', 'error');
      return;
    }
    enrollSelectedFile = new File([blob], 'webcam_enroll.jpg', { type: 'image/jpeg' });
    
    // Display captured preview
    const url = URL.createObjectURL(blob);
    enrollPreview.src = url;
    enrollPreviewWrap.hidden = false;
    showToast('Photo captured! Enter name and click "Enroll Face".', 'success');
  }, 'image/jpeg', 0.95);
});

enrollBrowse.addEventListener('click', () => enrollFile.click());
enrollFile.addEventListener('change', () => handleEnrollFile(enrollFile.files[0]));
enrollDrop.addEventListener('click', () => enrollFile.click());
enrollDrop.addEventListener('dragover', e => { e.preventDefault(); enrollDrop.classList.add('drag-over'); });
enrollDrop.addEventListener('dragleave', () => enrollDrop.classList.remove('drag-over'));
enrollDrop.addEventListener('drop', e => {
  e.preventDefault();
  enrollDrop.classList.remove('drag-over');
  handleEnrollFile(e.dataTransfer.files[0]);
});

function handleEnrollFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  enrollSelectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    enrollPreview.src = e.target.result;
    enrollPreviewWrap.hidden = false;
  };
  reader.readAsDataURL(file);
}

enrollBtn.addEventListener('click', async () => {
  const name = $('#enroll-name').value.trim();
  if (!name) { showToast('Please enter a name.', 'error'); return; }
  if (!enrollSelectedFile) { showToast('Please select an image.', 'error'); return; }

  enrollBtn.disabled = true;
  enrollStatus.className = 'enroll-status';
  enrollStatus.textContent = 'Enrolling…';

  const fd = new FormData();
  fd.append('name', name);
  fd.append('image', enrollSelectedFile);

  try {
    const res  = await fetch('/api/enroll', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.error) {
      enrollStatus.className   = 'enroll-status error';
      enrollStatus.textContent = data.error;
      showToast(data.error, 'error');
    } else {
      enrollStatus.className   = 'enroll-status success';
      enrollStatus.textContent = data.message;
      showToast(data.message, 'success');
      refreshStats();
      $('#enroll-name').value = '';
      enrollSelectedFile = null;
      enrollPreviewWrap.hidden = true;
    }
  } catch (err) {
    enrollStatus.className   = 'enroll-status error';
    enrollStatus.textContent = 'Enrollment failed.';
    showToast('Enrollment failed.', 'error');
  } finally {
    enrollBtn.disabled = false;
  }
});

/* ================================================================
   DATABASE TAB
   ================================================================ */
$('#refresh-db-btn').addEventListener('click', loadDatabase);

async function loadDatabase() {
  const grid = $('#db-grid');
  const empty = $('#db-empty');
  grid.innerHTML = '<div class="db-empty"><div class="spinner"></div></div>';

  try {
    const res  = await fetch('/api/database');
    const data = await res.json();
    grid.innerHTML = '';

    if (!data.people || data.people.length === 0) {
      grid.appendChild(empty);
      return;
    }

    data.people.forEach(p => {
      const card = document.createElement('div');
      card.className = 'db-person-card';
      const thumbHTML = p.thumbnail
        ? `<img class="db-thumb" src="data:image/jpeg;base64,${p.thumbnail}" alt="${p.name}">`
        : `<div class="db-thumb-placeholder">👤</div>`;
      card.innerHTML = `
        ${thumbHTML}
        <div class="db-name">${p.name}</div>
        <div class="db-count">${p.count} image(s)</div>
        <button class="db-delete-btn" data-raw="${p.raw_name}">🗑 Remove</button>`;
      grid.appendChild(card);
    });

    $$('.db-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const raw = btn.dataset.raw;
        if (!confirm(`Remove "${raw.replace(/_/g, ' ')}" from the database?`)) return;
        try {
          await fetch(`/api/database/${raw}`, { method: 'DELETE' });
          showToast(`Removed ${raw.replace(/_/g, ' ')}`, 'success');
          loadDatabase();
          refreshStats();
        } catch (_) { showToast('Delete failed.', 'error'); }
      });
    });

  } catch (err) {
    grid.innerHTML = '<div class="db-empty"><p>Failed to load database.</p></div>';
  }
}
