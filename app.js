/* global SpotifyAuth */

const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const nextBtn = document.getElementById("nextBtn");
const answerBtn = document.getElementById("answerBtn");
const answerEl = document.getElementById("answer");

let songs = [];
let currentSong = null;
let isReady = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function showAnswer(song) {
  answerEl.textContent = `${song.artist} — ${song.title}`;
  answerEl.classList.remove("hidden");
}

function hideAnswer() {
  answerEl.classList.add("hidden");
  answerEl.textContent = "";
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadSongs() {
  const res = await fetch("songs.json", { cache: "no-store" });
  if (!res.ok) throw new Error("songs.json lataus epäonnistui.");
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("songs.json on tyhjä tai virheellinen.");
  }
  songs = data;
}

async function playRandomSongSnippet() {
  if (!isReady) return;

  hideAnswer();
  currentSong = randomItem(songs);

  try {
    setStatus("Haetaan kappaleen tietoja...");
    const durationMs = await SpotifyAuth.getTrackDurationMs(currentSong.spotify);

    // 30 sekunnin pätkä satunnaisesta kohdasta
    const maxStart = Math.max(0, durationMs - 30000);
    const randomStartMs = Math.floor(Math.random() * (maxStart + 1));

    setStatus("Soitetaan 30 sekunnin pätkää...");
    await SpotifyAuth.playTrack(currentSong.spotify, randomStartMs);

    answerBtn.disabled = false;
    setTimeout(async () => {
      // Pysäytetään 30 sekunnin jälkeen
      try {
        await SpotifyAuth.pause();
      } catch (_) {}
    }, 30000);
  } catch (err) {
    console.error(err);
    setStatus("Toisto epäonnistui. Tarkista Premium-tili ja oikeudet.");
  }
}

async function init() {
  try {
    await loadSongs();
  } catch (err) {
    setStatus(err.message);
    return;
  }

  const authResult = await SpotifyAuth.handleRedirectIfNeeded();
  if (authResult.error) {
    setStatus(`Kirjautuminen epäonnistui: ${authResult.error}`);
    return;
  }

  if (SpotifyAuth.hasValidToken()) {
    setStatus("Yhdistetään Spotify-soittimeen...");
    try {
      await SpotifyAuth.initPlayer();
      isReady = true;
      nextBtn.disabled = false;
      loginBtn.disabled = true;
      setStatus("Valmis! Paina 'Seuraava kappale'.");
    } catch (err) {
      console.error(err);
      setStatus("Spotify-soittimen alustus epäonnistui.");
    }
  } else {
    setStatus("Kirjaudu Spotifyyn aloittaaksesi.");
  }
}

loginBtn.addEventListener("click", () => {
  SpotifyAuth.login();
});

nextBtn.addEventListener("click", () => {
  playRandomSongSnippet();
});

answerBtn.addEventListener("click", () => {
  if (currentSong) showAnswer(currentSong);
});

init();

