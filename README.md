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

## Get the downloader

Shelf needs a free program called yt-dlp. It is the part that saves the videos.

1. Open the [yt-dlp download page](https://github.com/yt-dlp/yt-dlp/releases/latest).
2. Find the file named `yt-dlp_macos`.
3. Download that file.
4. Move it into your **Downloads** folder.
5. Leave the name as `yt-dlp_macos`. Do not add `.txt` or any other ending.

## Run the file from Shelf

1. In Shelf, press **Save to Downloads**.
2. Open your **Downloads** folder. You should see `shelf-instagram.sh`.
3. Open **Terminal**. Press the Command key and the space bar, type `Terminal`, then press Return.
4. Type the line below, then press Return. This opens the Downloads folder inside Terminal.

```bash
cd ~/Downloads
```

5. Type the next line, then press Return. This lets the Mac run the file.

```bash
chmod +x shelf-instagram.sh
```

6. Type the next line, then press Return. This starts the download.

```bash
./shelf-instagram.sh
```

7. Wait until Terminal stops printing new lines.
8. Open **Downloads**, then open the folder **Instagram-Reels**. The videos are in there.

If the Mac says it cannot open the file, go to **System Settings**, then **Privacy & Security**, and press **Open Anyway**.

## Change Shelf on your computer

Do this only if you want to edit the app. You can skip it if you only want to save videos.

1. Download Node.js from [nodejs.org](https://nodejs.org). Press the big download button and install it.
2. Download this project and unzip it. Remember the folder. A common place is **Downloads**.
3. Open **Terminal**.
4. Type `cd`, then a space, then drag the project folder into the Terminal window. Press Return.
5. Type this line and press Return. Wait until it finishes. This gets the parts Shelf needs.

```bash
npm install
```

6. Type this line and press Return. This checks that Shelf works.

```bash
npm test
```

7. Type this line and press Return. This starts Shelf on your computer.

```bash
npm run dev
```

8. Terminal prints an address that starts with `http://localhost`. Hold Command and click that address. Shelf opens in your browser.


Live app: [mikhelangelo.github.io/shelf](https://mikhelangelo.github.io/shelf/).
