const { Client, MessageMedia, AuthStrategy } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const express = require("express");
const ytdl = require("ytdl-core");
const app = express();
const fluentFfmpeg = require("fluent-ffmpeg");
const bodyParser = require("body-parser");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

const client = new Client({
  puppeteer: {
    headless: false,
    //executablePath: '"C:\Program Files\Google\Chrome\Application\chrome.exe"',
  },
});

const storagefile = "user-storage.json";
let userStorage = fs.existsSync(storagefile) ? require(`./${storagefile}`) : {};

app.use(bodyParser.json());

// Declare dir variable here
const dir = path.resolve(__dirname, "D:\\bot dungu");

app.get("/convert", async (req, res) => {
  const youtubeURL = req.query.url;
  const user = req.query.user; // Get the user from the query string

  if (!youtubeURL) {
    return res.status(400).json({ error: "URL is required." });
  }

  // Declare video and audio streams outside the try block
  const videoReadableStream = ytdl(youtubeURL, { quality: "highestvideo" });
  videoReadableStream.on("error", (error) => {
    console.error("Error downloading video:", error);
    // Handle the error...
  });
  const audioReadableStream = ytdl(youtubeURL, { quality: "highestaudio" });
  audioReadableStream.on("error", (error) => {
    console.error("Error downloading audio:", error);
    // Handle the error...
  });

  try {
    // Fetch video info
    const info = await ytdl.getInfo(youtubeURL);
    const title = info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, "-"); // Sanitize the title

    // Define a temporary file to store the video
    const outputPath = path.join(dir, `${title}.mp4`);

    // Check and create the directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const videoPath = path.join(dir, `${title}_video.mp4`);
    const audioPath = path.join(dir, `${title}_audio.mp4`);

    ffmpeg(videoReadableStream)
      .videoCodec("copy")
      .save(videoPath)
      .on("end", () => {
        ffmpeg(audioReadableStream)
          .audioCodec("aac")
          .save(audioPath)
          .on("end", () => {
            ffmpeg()
              .input(videoPath)
              .input(audioPath)
              .videoCodec("copy")
              .audioCodec("copy")
              .outputOptions("-map 0:v", "-map 1:a")
              .save(outputPath)
              .on("end", async () => {
                const media = await MessageMedia.fromFilePath(outputPath);
                client.sendMessage(msg.from, media);

                // Clean up: delete the temporary video and audio files
                fs.unlink(videoPath, (err) => {
                  if (err) {
                    console.error("Error deleting video file:", err);
                  }
                });
                fs.unlink(audioPath, (err) => {
                  if (err) {
                    console.error("Error deleting audio file:", err);
                  }
                });
              });
          });
      });
  } catch (err) {
    console.error("An error occurred:", err);
    return res.status(500).json({
      error: "Yah perintahnya masih kurang tepat manis coba dicek lagi ya.",
    });
  }
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true }, console.log);
});

client.on("ready", () => console.log("Client is ready!"));

client.on("message", async (msg) => {
  const sender = msg.from;

  // opening message
  if (!userStorage[sender]) {
    userStorage[sender] = true;
    fs.writeFileSync(storagefile, JSON.stringify(userStorage, null, 2));
    client.sendMessage(
      msg.from,
      "Halo siapapun kamu, terimakasih udah make bot dungu ini, kalo mau tau fiturnya apa aja coba ketik !menu. Semoga harimu menyenangkan"
    );
    return;

    // menu
  } else {
    if (msg.body == "!menu") {
      msg.reply(`
    Hi pretty, ini beberapa fitur yang botnya udah punya, ketik !menu untuk melihat fitur-fiturnya:
    - kirim sticker (kirim gambar dengan keterangan !sticker)
    - ubah link yt ke mp3 (ketik !mp3 URL YT nya contoh: !mp3 https://youtu.be/2en_-MtO7bM?si=k-n4g-SWF0X9D9WG )
    - ketik !akuhomo untuk membuka fitur rahasia
    - ubah link yt ke mp4 (ketik !mp4 URL YT nya contoh: !mp4 https://youtu.be/2en_-MtO7bM?si=k-n4g-SWF0X9D9WG )
  `);

      // sticker
    } else if (msg.body.startsWith("!sticker") && msg.hasMedia) {
      const media = await msg.downloadMedia();
      client.sendMessage(msg.from, media, {
        sendMediaAsSticker: true,
        stickerAuthor: "Bot Dungu",
        stickerName: "Stiker dungu",
      });

      // akuhomo
    } else if (msg.body == "!akuhomo") {
      const stickerPath = "D:\\bot dungu\\aset bot\\Laughing-Emoji.png"; // Replace with the actual path to your sticker image
      const media = MessageMedia.fromFilePath(stickerPath);
      client.sendMessage(msg.from, media, { sendMediaAsSticker: true });

      // link yt to mp3
    } else if (msg.body.startsWith("!mp3")) {
      const url = msg.body.split(" ")[1]; // Assuming the URL is the second word in the message
      if (!url || !ytdl.validateURL(url)) {
        return msg.reply(
          "Yah perintahnya masih kurang tepat manis coba dicek lagi ya."
        );
      }

      // fluent-ffmpeg
      const stream = ytdl(url, { filter: "audioonly" });
      const filePath = `./${Date.now()}.mp3`;
      const converter = new fluentFfmpeg({ source: stream })
        .toFormat("mp3")
        .saveToFile(filePath);
      converter.on("end", () => {
        const media = MessageMedia.fromFilePath(filePath);
        client.sendMessage(msg.from, media); // Use msg.from instead of user
      });

      // yt to mp4
    } else if (msg.body.startsWith("!mp4")) {
      const youtubeURL = msg.body.split(" ")[1]; // Assuming the URL is the second word in the message
      if (!youtubeURL || !ytdl.validateURL(youtubeURL)) {
        return msg.reply(
          "Yah perintahnya masih kurang tepat manis coba dicek lagi ya."
        );
      }

      try {
        // Fetch video info
        const info = await ytdl.getInfo(youtubeURL);
        const title = info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, "-"); // Sanitize the title

        // Inform user that the conversion process has started
        msg.reply("Memulai konversi video, harap tunggu sebentar...");

        // Define a temporary file to store the video
        const outputPath = `D:\\bot dungu\\${title}.mp4`;

        const videoReadableStream = ytdl(youtubeURL, {
          quality: "highestvideo",
        });
        const audioReadableStream = ytdl(youtubeURL, {
          quality: "highestaudio",
        });

        const videoPath = path.join(dir, `${title}_video.mp4`);
        const audioPath = path.join(dir, `${title}_audio.mp4`);

        ffmpeg(videoReadableStream)
          .videoCodec("copy")
          .save(videoPath)
          .on("end", () => {
            ffmpeg(audioReadableStream)
              .audioCodec("aac")
              .save(audioPath)
              .on("end", () => {
                ffmpeg()
                  .input(videoPath)
                  .input(audioPath)
                  .videoCodec("copy")
                  .audioCodec("copy")
                  .outputOptions("-map", "0:v", "-map", "1:a:0") // Apply input options here
                  .save(outputPath)
                  .on("end", async () => {
                    const media = await MessageMedia.fromFilePath(outputPath);
                    client.sendMessage(msg.from, media, {
                      caption: "Ini file videonya ya",
                      sendMediaAsDocument: true,
                    });

                    // Clean up: delete the temporary video and audio files
                    fs.unlink(videoPath, (err) => {
                      if (err) {
                        console.error("Error deleting video file:", err);
                      }
                    });
                    fs.unlink(audioPath, (err) => {
                      if (err) {
                        console.error("Error deleting audio file:", err);
                      }
                    });
                  });
              });
          });
      } catch (error) {
        console.error("An error occurred:", error);
        // Provide informative error messages to the user
        if (error.code === "ENOTFOUND") {
          return msg.reply(
            "Maaf, tidak dapat terhubung ke server YouTube. Silakan coba lagi nanti."
          );
        } else if (error.message.includes("This is a private video")) {
          return msg.reply(
            "Maaf, video ini bersifat pribadi dan tidak dapat diunduh."
          );
        } else {
          return msg.reply(
            "Maaf, terjadi kesalahan saat melakukan konversi. Silakan coba lagi nanti."
          );
        }
      }
    } else {
      msg.reply("Ditunggu ya");
    }
  }
});

client.initialize();
