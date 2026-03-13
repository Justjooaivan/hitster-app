import json
import requests
import base64
import time

CLIENT_ID = "191fb613044f4862bc1c7c92f14547ff"
CLIENT_SECRET = "58cdfea5133b477f923803ce3a9531b6"

INPUT_FILE = "songs.json"
OUTPUT_FILE = "songs_with_spotify.json"

REQUEST_DELAY = 0.12


def get_access_token():

    auth_string = CLIENT_ID + ":" + CLIENT_SECRET
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")

    url = "https://accounts.spotify.com/api/token"

    headers = {
        "Authorization": "Basic " + auth_base64,
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "client_credentials"
    }

    response = requests.post(url, headers=headers, data=data)

    return response.json()["access_token"]


def search_track(artist, title, token):

    url = "https://api.spotify.com/v1/search"

    headers = {
        "Authorization": "Bearer " + token
    }

    query = f'track:"{title}" artist:"{artist}"'

    params = {
        "q": query,
        "type": "track",
        "limit": 1
    }

    r = requests.get(url, headers=headers, params=params)

    if r.status_code != 200:
        return None

    data = r.json()

    items = data["tracks"]["items"]

    if len(items) == 0:
        return None

    return items[0]["uri"]


def save_progress(songs):

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(songs, f, indent=2, ensure_ascii=False)


def main():

    print("Haetaan Spotify access token...")

    token = get_access_token()

    print("Token saatu")

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        songs = json.load(f)

    total = len(songs)

    found = 0
    missing = 0

    for i, song in enumerate(songs):

        artist = song["artist"]
        title = song["title"]

        if song["spotify"] != "":
            continue

        print(f"{i+1}/{total}  Haetaan: {artist} - {title}")

        uri = search_track(artist, title, token)

        if uri:
            song["spotify"] = uri
            found += 1
        else:
            missing += 1
            print("Ei löytynyt")

        if i % 25 == 0:
            save_progress(songs)

        time.sleep(REQUEST_DELAY)

    save_progress(songs)

    print("")
    print("Valmis!")
    print("Löytyi:", found)
    print("Ei löytynyt:", missing)


if __name__ == "__main__":
    main()
