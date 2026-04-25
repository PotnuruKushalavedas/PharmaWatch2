const API_KEY = 'AIzaSyCRs_h1Dlyn4PWVPICMIEsNLQF1HM1xkpg';

async function listModels() {
  try {
    console.log("Listing models via REST API...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("API ERROR:", JSON.stringify(data.error, null, 2));
    } else {
      console.log("AVAILABLE MODELS:");
      if (data.models) {
        data.models.forEach(m => console.log(`- ${m.name}`));
      } else {
        console.log("No models returned.");
      }
    }
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

listModels();
