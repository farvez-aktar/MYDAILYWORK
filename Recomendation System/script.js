// =============================================
// CONTENT-BASED FILTERING RECOMMENDATION ENGINE
// =============================================

// --- State ---
let currentMovie = null;
let searchQuery = "";
let activeGenreFilter = "All";

// --- Algorithm: Jaccard Similarity ---
function jaccardSimilarity(setA, setB) {
  const a = new Set(setA.map(x => x.toLowerCase()));
  const b = new Set(setB.map(x => x.toLowerCase()));
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// --- Compute similarity score between two movies ---
function computeSimilarity(movieA, movieB) {
  if (movieA.id === movieB.id) return 0;
  const genreSim = jaccardSimilarity(movieA.genres, movieB.genres);
  const tagSim = jaccardSimilarity(movieA.tags, movieB.tags);
  // Weighted: genres 50%, tags 50%
  return genreSim * 0.5 + tagSim * 0.5;
}

// --- Get top N recommendations for a movie ---
function getRecommendations(movie, n = 6) {
  return movies
    .filter(m => m.id !== movie.id)
    .map(m => ({ ...m, score: computeSimilarity(movie, m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// --- Get all unique genres ---
function getAllGenres() {
  const genres = new Set(["All"]);
  movies.forEach(m => m.genres.forEach(g => genres.add(g)));
  return [...genres];
}

// --- Filter movies by search and genre ---
function getFilteredMovies() {
  return movies.filter(m => {
    const matchesSearch =
      searchQuery === "" ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.genres.some(g => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre =
      activeGenreFilter === "All" || m.genres.includes(activeGenreFilter);
    return matchesSearch && matchesGenre;
  });
}

// =============================================
// RENDER FUNCTIONS
// =============================================

function renderStars(rating) {
  const stars = Math.round(rating / 2);
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

function renderGenreBadges(genres) {
  return genres.map(g => `<span class="genre-badge">${g}</span>`).join("");
}

function createMovieCard(movie, isRecommendation = false) {
  const card = document.createElement("div");
  card.className = "movie-card" + (isRecommendation ? " recommendation-card" : "");
  card.dataset.id = movie.id;

  const scoreHTML = isRecommendation && movie.score !== undefined
    ? `<div class="match-score"><span class="match-dot"></span>${Math.round(movie.score * 100)}% Match</div>`
    : "";

  card.innerHTML = `
    <div class="card-poster-wrap">
      <img class="card-poster" src="${movie.poster}" alt="${movie.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450/1a1a2e/00f5d4?text=No+Image'">
      <div class="card-overlay">
        <div class="card-overlay-content">
          <p class="card-description">${movie.description}</p>
          <button class="btn-similar" data-id="${movie.id}">Find Similar</button>
        </div>
      </div>
      ${scoreHTML}
      <div class="card-rating-badge">${movie.rating} ⭐</div>
    </div>
    <div class="card-info">
      <h3 class="card-title">${movie.title}</h3>
      <div class="card-meta">
        <span class="card-year">${movie.year}</span>
        <span class="card-director">🎬 ${movie.director}</span>
      </div>
      <div class="card-genres">${renderGenreBadges(movie.genres)}</div>
    </div>
  `;

  card.querySelector(".btn-similar").addEventListener("click", (e) => {
    e.stopPropagation();
    selectMovie(movie);
  });

  card.addEventListener("click", () => selectMovie(movie));
  return card;
}

function renderMovieGrid() {
  const grid = document.getElementById("movie-grid");
  const noResults = document.getElementById("no-results");
  const filtered = getFilteredMovies();

  grid.innerHTML = "";
  if (filtered.length === 0) {
    noResults.style.display = "flex";
    return;
  }
  noResults.style.display = "none";
  filtered.forEach(movie => {
    grid.appendChild(createMovieCard(movie));
  });
}

function renderRecommendations(movie) {
  const section = document.getElementById("recommendations-section");
  const title = document.getElementById("rec-movie-title");
  const grid = document.getElementById("recommendations-grid");
  const heroTitle = document.getElementById("selected-hero-title");
  const heroYear = document.getElementById("selected-hero-year");
  const heroGenres = document.getElementById("selected-hero-genres");
  const heroDesc = document.getElementById("selected-hero-desc");
  const heroPoster = document.getElementById("selected-hero-poster");
  const heroRating = document.getElementById("selected-hero-rating");

  const recs = getRecommendations(movie);

  // Hero panel
  heroTitle.textContent = movie.title;
  heroYear.textContent = movie.year;
  heroGenres.innerHTML = renderGenreBadges(movie.genres);
  heroDesc.textContent = movie.description;
  heroPoster.src = movie.poster;
  heroPoster.onerror = () => { heroPoster.src = 'https://via.placeholder.com/300x450/1a1a2e/00f5d4?text=No+Image'; };
  heroRating.innerHTML = `${movie.rating} <span class="stars">${renderStars(movie.rating)}</span>`;

  title.textContent = movie.title;
  grid.innerHTML = "";
  recs.forEach(rec => grid.appendChild(createMovieCard(rec, true)));

  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderGenreFilters() {
  const container = document.getElementById("genre-filters");
  const genres = getAllGenres();
  container.innerHTML = "";
  genres.forEach(genre => {
    const btn = document.createElement("button");
    btn.className = "genre-filter-btn" + (genre === activeGenreFilter ? " active" : "");
    btn.textContent = genre;
    btn.addEventListener("click", () => {
      activeGenreFilter = genre;
      renderGenreFilters();
      renderMovieGrid();
    });
    container.appendChild(btn);
  });
}

// =============================================
// EVENT HANDLERS
// =============================================

function selectMovie(movie) {
  currentMovie = movie;
  // Highlight selected card
  document.querySelectorAll(".movie-card").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(`.movie-card[data-id="${movie.id}"]`).forEach(c => c.classList.add("selected"));
  renderRecommendations(movie);
}

function handleSearch(e) {
  searchQuery = e.target.value;
  renderMovieGrid();
}

function clearSearch() {
  searchQuery = "";
  document.getElementById("search-input").value = "";
  renderMovieGrid();
}

// --- Particle background ---
function initParticles() {
  const canvas = document.getElementById("particle-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.1
    };
  }

  function init() {
    particles = Array.from({ length: 120 }, createParticle);
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 245, 212, ${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }

  resize();
  init();
  animate();
  window.addEventListener("resize", () => { resize(); init(); });
}

// =============================================
// INIT
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  renderGenreFilters();
  renderMovieGrid();

  document.getElementById("search-input").addEventListener("input", handleSearch);
  document.getElementById("clear-search").addEventListener("click", clearSearch);
  document.getElementById("close-recommendations").addEventListener("click", () => {
    document.getElementById("recommendations-section").style.display = "none";
    currentMovie = null;
    document.querySelectorAll(".movie-card").forEach(c => c.classList.remove("selected"));
  });

  // Stats
  document.getElementById("stat-movies").textContent = movies.length;
  const genres = new Set();
  movies.forEach(m => m.genres.forEach(g => genres.add(g)));
  document.getElementById("stat-genres").textContent = genres.size;
});
