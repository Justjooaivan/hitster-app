const SpotifyAuth = (() => {
  // Vaihda tämä omaan Spotify App Client ID:hen
  const CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID";
  const REDIRECT_URI = window.location.origin + window.location.pathname;

  const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state"
  ];

  const TOKEN_KEY = "hitster_access_token";
  const EXPIRES_KEY = "hitster_expires_at";
  const VERIFIER_KEY = "hitster_pkce_verifier";

  let player = null;
  let deviceId = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token, expiresInSec) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInSec * 1000));
  }

  function hasValidToken() {
    const token = getToken();
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || "0");
    return Boolean(token && Date.now() < expiresAt);
  }

  function generateRandomString(length = 64) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    array.forEach((x) => (result += chars[x % chars.length]));
    return result;
  }

  async function sha256(plain) {
    const data = new TextEncoder().encode(plain);
    return crypto.subtle.digest("SHA-256", data);
  }

  function base64UrlEncode(arrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function login() {
    if (CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID") {
      alert("Aseta spotify.js-tiedostoon oma CLIENT_ID.");
      return;
    }

    const verifier = generateRandomString(128);
    localStorage.setItem(VERIFIER_KEY, verifier);

    const challenge = base64UrlEncode(await sha256(verifier));
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge: challenge,
      redirect_uri: REDIRECT_URI
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async function handleRedirectIfNeeded() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) return { error };

    if (!code) return { ok: true };

    const verifier = localStorage.getItem(VERIFIER_KEY);
    if (!verifier) return { error: "PKCE verifier puuttuu." };

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error_description || data.error || "Token-haku epäonnistui." };
    }

    setToken(data.access_token, data.expires_in);

    // Siivotaan query-parametrit pois URL:sta
    window.history.replaceState({}, document.title, REDIRECT_URI);
    return { ok: true };
  }

  async function api(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Token puuttuu.");

    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || "Spotify API virhe.");
    return data;
  }

  function parseTrackId(spotifyUri) {
    // spotify:track:TRACK_ID
    const parts = spotifyUri.split(":");
    return parts[2];
  }

  async function getTrackDurationMs(spotifyUri) {
    const id = parseTrackId(spotifyUri);
    const data = await api(`/tracks/${id}`, { method: "GET" });
    return data.duration_ms;
  }

  async function initPlayer() {
    if (!window.Spotify) {
      throw new Error("Spotify SDK ei latautunut.");
    }

    if (!hasValidToken()) {
      throw new Error("Ei voimassa olevaa tokenia.");
    }

    player = new window.Spotify.Player({
      name: "Hitster Music Game Player",
      getOAuthToken: (cb) => cb(getToken()),
      volume: 0.8
    });

    return new Promise((resolve, reject) => {
      player.addListener("ready", async ({ device_id }) => {
        deviceId = device_id;
        try {
          await api("/me/player", {
            method: "PUT",
            body: JSON.stringify({
              device_ids: [deviceId],
              play: false
            })
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      player.addListener("initialization_error", ({ message }) => reject(new Error(message)));
      player.addListener("authentication_error", ({ message }) => reject(new Error(message)));
      player.addListener("account_error", ({ message }) => reject(new Error(message)));
      player.addListener("playback_error", ({ message }) => reject(new Error(message)));

      player.connect();
    });
  }

  async function playTrack(spotifyUri, positionMs = 0) {
    if (!deviceId) throw new Error("Laite ei ole valmis.");

    await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      body: JSON.stringify({
        uris: [spotifyUri],
        position_ms: positionMs
      })
    });
  }

  async function pause() {
    if (!deviceId) return;
    await api(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: "PUT" });
  }

  return {
    login,
    handleRedirectIfNeeded,
    hasValidToken,
    initPlayer,
    getTrackDurationMs,
    playTrack,
    pause
  };
})();

