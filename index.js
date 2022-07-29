import * as fs from 'fs';
import fetch from 'node-fetch';
import striptags from 'striptags';
import sharp from 'sharp';
import { createCanvas, registerFont, loadImage as loadImageCanvas } from 'canvas';
import { TwitterApi } from 'twitter-api-v2';

const base_url = process.env.ASSETS_URL || 'https://acrossoverepisode-assets2.storage.googleapis.com';
const asset_extension = process.env.ASSETS_EXTENSION || 'png';

const prepareFrame = (id, { episode, html, season }) => {
  return {
    id,
    episode,
    season,
    text: striptags(html),
  }
}

const loadFrame = ({ documentIds, storedFields }, season, episode, id, delta) => {
  const reverseIndex = Object.fromEntries(Object.entries(documentIds || {}).map(([index, id]) => {
    const f = storedFields[index];
    return [`${f.season}:${f.episode}:${id}`, index];
  }))
  const currentFrame = `${season}:${episode}:${id}`
  const key = (parseInt(reverseIndex[currentFrame], 10) + delta) + ''
  return {
    id: documentIds[key],
    episode: storedFields[key].episode,
    html: storedFields[key].html,
    season: storedFields[key].season
  }
}

const getRandomSequence = ({ documentIds, storedFields }) => {
  const sequence = [];
  const keys = Object.keys(storedFields);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const { id, episode, text, season } = prepareFrame(documentIds[key], storedFields[key]);
  const needPrevious = text[0].match(/[a-z]/) !== null;
  if (needPrevious) {
    const ep = loadFrame({ documentIds, storedFields }, season, episode, id, -1);
    sequence.push(prepareFrame(ep.id, ep));
  }
  sequence.push({ id, episode, text, season })
  const needNext = text[text.length-1].match(/[a-z,]/) !== null;
  if (needNext) {
    const ep = loadFrame({ documentIds, storedFields }, season, episode, id, 1);
    sequence.push(prepareFrame(ep.id, ep));
  }

  return sequence;
}

const frameURL = ({ id, season, episode }) => `${base_url}/${season}x${('' + episode).padStart(2, '0')}/${id}_still.${asset_extension}`

const loadImage = async (url) => {
  const req = await fetch(url);
  const data = Buffer.from(await req.arrayBuffer());
  const img = await sharp(data).toFormat('png').toBuffer()
  return loadImageCanvas(img);
}

const drawSequence = async (sequence) => {
  const urls = sequence.map((frame) => frameURL(frame));
  const images = await Promise.all(urls.map(loadImage));
  const canvas = createCanvas(images[0].width, images[0].height * images.length)
  const ctx = canvas.getContext('2d')
  images.forEach((image, i) => {
    ctx.drawImage(image, 0, i * images[0].height, image.width, image.height)
  });
  images.forEach((image, i) => {
    // ugly copy paste from https://github.com/seppo0010/acrossoverepisode.com/blob/main/src/App.tsx#L147
    let size = 48
    const padding = 10
    ctx.font = size + 'px acrossoverepisode-font'
    ctx.fillStyle = 'yellow'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    const caption = sequence[i].text;
    const lines = caption.split('\n')
    let height = size - 4
    lines.forEach((line) => {
      while (size > 10) {
        const measure = ctx.measureText(line)
        if (measure.width > image.width - 2 * padding) {
          size--
          ctx.font = size + 'px acrossoverepisode-font'
        } else {
          break
        }
        if (measure.actualBoundingBoxDescent < size) {
          height = measure.actualBoundingBoxDescent
        }
      }
    })
    lines.reverse().forEach((line, j) => {
      const x = image.width / 2
      const y = image.height - height * (1 + j) - padding
      ctx.lineWidth = 6
      ctx.strokeText(line, x, y + i * images[0].height)
      ctx.fillText(line, x, y + i * images[0].height)
    })
  });
  return canvas;
}

const tweetPhoto = async (sequence, picture) => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });
  const mediaId = await client.v1.uploadMedia(picture.toBuffer(), { mimeType: 'image/png' });
  await client.v1.createMediaMetadata(mediaId, { alt_text: { text: sequence.map(({ text }) => text).join('\n') } });
  await client.v2.tweet('', { media: { media_ids: [mediaId] } });
};

const tweetRandomSequence = async (index) => {
  const sequence = getRandomSequence(index);
  const picture = await drawSequence(sequence);
  tweetPhoto(sequence, picture);
}

(async() => {
  if (!fs.existsSync('index.json')) {
    const req = await fetch(`${base_url}/index.json`);
    fs.writeFileSync('index.json', await req.text());
  }
  if (!fs.existsSync('font.ttf')) {
    const req = await fetch(`${base_url}/font.ttf`);
    fs.writeFileSync('font.ttf', Buffer.from(await req.arrayBuffer()));
  }
  registerFont('font.ttf', { family: 'acrossoverepisode-font' })
  tweetRandomSequence(JSON.parse(fs.readFileSync('index.json')));
})()
