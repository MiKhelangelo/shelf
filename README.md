# Shelf

Paste a link. Keep the video.

Shelf is a quiet place for Instagram posts and Reels. You paste a link, or a whole list. Shelf remembers them, skips copies, and hands you one small file. Open that file on your Mac. The videos land in Downloads.

Nothing is uploaded. Your login stays in Safari or Firefox.

## Three steps

1. Paste a post or Reel. Up to 200 at a time.
2. Press **Save to Downloads**.
3. Open the file. The videos follow.

## What you can do

- Keep a shelf you can search later.
- Skip a video you already saved, or save it again.
- Show pictures first, if you want them.
- Download a few at a time, so one failure does not stop the rest.
- Use the Instagram login already open on your Mac.

Stories and profiles are left out. Posts and Reels are the whole idea.

## On your Mac

You need [yt-dlp](https://github.com/yt-dlp/yt-dlp), a free downloader. The usual place is `$HOME/Downloads/yt-dlp_macos`.

```bash
chmod +x shelf-instagram.sh
./shelf-instagram.sh
```

The videos go to `Downloads/Instagram-Reels`.

## Make it your own

```bash
npm install
npm test
npm run dev
```

The live app is at [mikhelangelo.github.io/shelf](https://mikhelangelo.github.io/shelf/).
