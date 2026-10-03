# Shelf

A small private app for turning Instagram post and reel links into a yt-dlp script that runs on your Mac.

The page never downloads the video and never reads browser cookies unless you turn that on. The queue stays in the tab. Saved files are named by id, not by account.

## Use it

Open the published app, paste one link or a list, then press **Download**. On your Mac:

```bash
chmod +x shelf-instagram.sh
./shelf-instagram.sh
```

You need [yt-dlp](https://github.com/yt-dlp/yt-dlp) at the path shown in Options. The default is `$HOME/Downloads/yt-dlp_macos`.

## Run it yourself

```bash
npm install
npm test
npm run dev
```

`npm run build` writes a static site to `dist/`.
