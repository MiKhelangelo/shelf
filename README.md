# Shelf

Save Instagram posts and Reels to your Mac.

Paste one link, or up to 200. Shelf keeps a searchable library, skips duplicates, and saves one file to Downloads. Open that file and the videos are saved on your computer.

Your browser login stays in Safari or Firefox. Nothing is uploaded.

## Steps

1. Paste a post or Reel link.
2. Choose **Save to Downloads**.
3. Open the file. The videos are saved to `Downloads/Instagram-Reels`.

## Included

- Search the library by code or link.
- Skip items you already saved, or download them again.
- Optional thumbnails before you download.
- Several downloads at a time. If one fails, the rest continue.
- Use the Instagram session already open in Safari or Firefox.

Stories and profile links are not included.

## Requirements

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp). The default path is `$HOME/Downloads/yt-dlp_macos`.

```bash
chmod +x shelf-instagram.sh
./shelf-instagram.sh
```

## Develop

```bash
npm install
npm test
npm run dev
```

Live app: [mikhelangelo.github.io/shelf](https://mikhelangelo.github.io/shelf/).
