# Shelf

Download the Shelf app to your Mac.

`./shelf-instagram.sh` downloads the app into `Downloads/shelf`. It does not download videos.

Live app: [mikhelangelo.github.io/shelf](https://mikhelangelo.github.io/shelf/).

## Run the file

1. Open **Terminal**. Press the Command key and the space bar, type `Terminal`, then press Return.
2. Paste this line and press Return. This gets the current file.

```bash
curl -fsSL -o ~/Downloads/shelf-instagram.sh https://raw.githubusercontent.com/MiKhelangelo/shelf/main/shelf-instagram.sh
```

3. Type this line and press Return.

```bash
cd ~/Downloads
```

4. Type this line and press Return.

```bash
chmod +x shelf-instagram.sh
```

5. Type this line and press Return. This downloads the app only.

```bash
./shelf-instagram.sh
```

6. Wait until Terminal says the app is in `Downloads/shelf` and that no videos were downloaded.

If the Mac says it cannot open the file, go to **System Settings**, then **Privacy & Security**, and press **Open Anyway**.

## Open the downloaded app

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
