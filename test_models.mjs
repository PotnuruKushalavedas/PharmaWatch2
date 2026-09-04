import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyCG6zHG5z57hdTMdW0yt-BbjO85_QCCbiM';

async function run() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch(e) {
    console.error(e);
  }
}

run();
