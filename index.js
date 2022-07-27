import * as fs from 'fs';
import fetch from 'node-fetch';
import striptags from 'striptags'

const prepareFrame = ({ episode, html, season }) => {
  return {
    episode,
    season,
    text: striptags(html),
  }
}

const getRandomSequence = ({ storedFields }) => {
  const sequence = [];
  const keys = Object.keys(storedFields);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const { episode, text, season } = prepareFrame(storedFields[key]);
  const needPrevious = text[0].match(/[a-z]/) !== null;
  if (needPrevious && storedFields[key-1]) {
    sequence.push(prepareFrame(storedFields[key-1]));
  }
  sequence.push({ episode, text, season })
  const needNext = text[text.length-1].match(/[a-z,]/) !== null;
  if (needNext && storedFields[key+1]) {
    sequence.push(prepareFrame(storedFields[key+1]));
  }

  return sequence;
}

const tweetRandomSequence = ({ storedFields }) => {
  const sequence = getRandomSequence({ storedFields });
  console.log(sequence);
}

(async() => {
  if (!fs.existsSync('index.json')) {
    const base_url = process.env.ASSETS_URL || 'https://acrossoverepisode-assets2.storage.googleapis.com';
    const req = await fetch(`${base_url}/index.json`);
    fs.writeFileSync('index.json', await req.text());
  }
  tweetRandomSequence(JSON.parse(fs.readFileSync('index.json')));
})()
