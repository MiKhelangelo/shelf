# Shelf

A private library for Instagram posts and reels. Paste up to 200 links, catch duplicates, and download a yt-dlp script that runs on your Mac.

The page never downloads the video itself. Thumbnails are optional and load only if you turn them on. The queue is saved in this browser. Cookies stay in Safari or Firefox.

## Use it

Open the app, paste one link or a list, then press **Download**. On your Mac:

```bash
chmod +x shelf-instagram.sh
./shelf-instagram.sh
```

You need [yt-dlp](https://github.com/yt-dlp/yt-dlp) at the path shown under the script. The default is `$HOME/Downloads/yt-dlp_macos`. Choose Safari or Firefox if those posts need the login already in that browser. Skip leaves finished links alone. Redownload saves them again. Careful mode runs up to four downloads at once.

## Run it yourself

```bash
npm install
npm test
npm run dev
```

`npm run build` writes a static site to `dist/`.
