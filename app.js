const credentials = require("./oauth.json");
const { google } = require("googleapis");
const youtube = google.youtube({ version: "v3" });
const express = require("express");
const OAuth2 = google.auth.OAuth2;
const fs = require("fs");
const allVideos = require('./allVideos.json')

async function setUpOauth() {
  const webServer = await startWebServer();
  const oAuthClient = await createOAuthClient();
  requestUserConsent(oAuthClient);
  const authorizationToken = await waitForGoogleCallback(webServer);
  try {
    await requestGoogleForAccessToknes(oAuthClient, authorizationToken);
    console.log("setGlobalGoogleAuthentication");
    setGlobalGoogleAuthentication(oAuthClient);
    console.log("Starting Video Uploads... \n");
    await uploadAll()
  } catch (e) {
    console.log(e);
  }
}

async function startWebServer() {
  return new Promise((resolve, reject) => {
    const port = 5000;
    const app = express();

    const server = app
      .listen(port, () => {
        console.log(`Listening on port ${port}`);

        resolve({ app, server });
      })
      .on("error", reject);
  });
}

async function waitForGoogleCallback(webServer) {
  return new Promise((resolve, reject) => {
    webServer.app.get("/oauth2:callback", (req, res) => {
      const authCode = req.query.code;
      console.log(`> Consent given:`, authCode);

      res.send("Thank you.\n Now Close this tab");
      resolve(authCode);
    });
  });
}

async function createOAuthClient() {
  const oAuthClient = new OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  );

  return oAuthClient;
}

function requestUserConsent(oAuthClient) {
  const consentUrl = oAuthClient.generateAuthUrl({
    acces_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube"],
  });

  console.log("> Please give your consent: ", consentUrl);
}

async function requestGoogleForAccessToknes(oAuthClient, authorizationToken) {
  return new Promise((resolve, reject) => {
    oAuthClient.getToken(authorizationToken, (error, tokens) => {
      if (error) {
        return reject(error);
      }

      console.log("> Access tokens received:", tokens);

      oAuthClient.setCredentials(tokens);
      resolve();
    });
  });
}

function setGlobalGoogleAuthentication(oAuthClient) {
  google.options({ auth: oAuthClient });
}

async function uploadVideo(video, folder) {
  const path = `./${folder}/${video.replace(/\s/g, " ")}`;
  const size = fs.statSync(path).size;
  const title = video.replace(".mp4", "");
  const description = "";
  const tags = [];

  const requestParams = {
    part: "snippet, status",
    requestBody: {
      snippet: {
        title,
        description,
        tags,
      },
      status: {
        privacyStatus: "unlisted",
      },
    },
    media: {
      body: fs.createReadStream(path),
    },
  };

  const youtubeResponse = await youtube.videos.insert(requestParams, {
    onUploadProgress: onUploadProgress,
  });

  console.log(`Upload finished! - at ${new Date().toUTCString()} \nVideo avaliable at: https://youtu.be/${youtubeResponse.data.id}\n`)

  function onUploadProgress(event) {
    const progress = Math.round((event.bytesRead / size) * 100);

    console.log(`> ${progress} % completed`);
  }
}

async function uploadAll() {
  const folders = Object.keys(allVideos);
  for (const folder of folders) {
    const folderVideos = allVideos[folder];
    for (const video of folderVideos) {
      await uploadVideo(video, folder);
    }
  }
}

setUpOauth();