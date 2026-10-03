# Shelf

Download the Shelf app to your Mac.

`./shelf-instagram.sh` downloads the app into `Downloads/shelf`. It does not download videos.

Live app: [mikhelangelo.github.io/shelf](https://mikhelangelo.github.io/shelf/).

## Run the file

1. Open the live app and press **Save to Downloads**. You should get `shelf-instagram.sh`.
2. Open **Terminal**. Press the Command key and the space bar, type `Terminal`, then press Return.
3. Type the line below, then press Return. This opens the Downloads folder inside Terminal.

```bash
cd ~/Downloads
```

4. Type the next line, then press Return. This lets the Mac run the file.

```bash
chmod +x shelf-instagram.sh
```

5. Type the next line, then press Return. This downloads the app. It does not download videos.

```bash
./shelf-instagram.sh
```

6. Wait until Terminal says the app is in `Downloads/shelf`.

An older `shelf-instagram.sh` already in Downloads can still download videos. Save a new file from the page, or run the copy in this repository, before using that command.

If the Mac says it cannot open the file, go to **System Settings**, then **Privacy & Security**, and press **Open Anyway**.

## Open the downloaded app

The file is the Shelf project, not a video.

1. Download Node.js from [nodejs.org](https://nodejs.org). Press the big download button and install it.
2. Open **Terminal**.
3. Type the lines below, then press Return after each one.

```bash
cd ~/Downloads/shelf
npm install
npm test
npm run dev
```

4. Terminal prints an address that starts with `http://localhost`. Hold Command and click that address. Shelf opens in your browser.
