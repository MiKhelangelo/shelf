# Shelf

This page keeps Instagram links in your browser. Videos are saved only if you run the script on your Mac.

[![Pages](https://github.com/MiKhelangelo/shelf/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/MiKhelangelo/shelf/actions/workflows/pages.yml)
![Static web app](https://img.shields.io/badge/web_app-static-677184)
![Browser-local library](https://img.shields.io/badge/library-browser--local-c74826)

**[Open Shelf](https://mikhelangelo.github.io/shelf/)** · [Read the guide](docs/guide.md) · [Report an issue](https://github.com/MiKhelangelo/shelf/issues)

![Shelf in the browser](docs/shelf-preview.jpg)

| | What Shelf does |
| --- | --- |
| Collect | Keep Instagram posts and Reels. Duplicate links are skipped. |
| Remember | Add a title, notes, and searchable hashtags. |
| Find again | Search your library. Play videos from a folder you choose. |
| Keep a copy | Export and import a JSON backup of links and notes, not the videos. |

## How it works

1. **Paste links.** New links are selected.
2. **Get the save script.** The button is next to **Add to library**. The page also shows these three Terminal lines:

   ```bash
   brew install yt-dlp
   cd ~/Downloads
   bash shelf-instagram.sh
   ```

3. **Open the saved folder.** Captions become searchable. Reopen the folder after a reload. The browser forgets the files.
4. **Read the status.** **Not saved** means the link is only in the library. **Found in folder** means Shelf saw a video file. **Failed** means the script recorded a problem.

The script runs in Terminal, never in the browser. It does not use login cookies. Instagram can refuse a post. The link library works without the script.

The page sends no library or file data to a service. GitHub Pages only receives the ordinary request for the page. The [guide](docs/guide.md) covers limits, storage, and what the script contacts.

## Run locally

No build is required. From this folder:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [localhost:4173](http://127.0.0.1:4173). Tests need Node.js 18 or newer:

```bash
node --test tests/lib.test.js
```

[Guide](docs/guide.md) · [Review](REVIEW.md) · [Script source](shelf-script.js) · [Tests](tests/lib.test.js)

Independent project, not affiliated with Instagram or Meta. Save only what you have permission to keep. Saving is not permission to repost.
