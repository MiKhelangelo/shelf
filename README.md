# Shelf

Saves posts and Reels you choose to your Mac. Everything stays on your computer.

There is no Shelf account, no upload, and no Shelf server. Shelf does not sign in to Instagram and does not read Safari, Chrome, or Firefox cookies. Private posts will not download. Nothing you save is shared. Not affiliated with Instagram or Meta. Respect the creator’s rights and Instagram’s terms.

This repository is only the local app. It does not include accounts, a database, or a server.

The page is the product. macOS 12 or later. Save `shelf-instagram.sh` only if you want the video files. The page shows that file’s SHA-256 checksum and what each step does. The file always passes `--no-cookies`.

## Mac window

`mac/` is a small Swift window around the same page. It does not read browser cookies. It is not signed or notarized, so macOS may ask you to allow it.

1. On a Mac, open Terminal in this folder.
2. Run `bash mac/build.sh`.
3. Open `mac/Shelf.app`.

There is no signed `.dmg`.

Questions and takedown requests: [GitHub issues](https://github.com/MiKhelangelo/shelf/issues).

## Steps

1. Paste a post or Reel link.
2. Choose **Save to Downloads**.
3. Optional: copy the Terminal steps and run them. Videos go to `Downloads/Instagram-Reels`, with `shelf-index.json` beside them.

## Included

- Search your own library by title, tag, author, or note.
- Grid and list views, collections, and a status for each item: Chosen, Saved, Failed, or Already have it.
- Skip items you already saved, or download them again.
- Optional thumbnails before you download.
- If one video fails, the rest continue, and Terminal says the post may be private, deleted, or changed.

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
