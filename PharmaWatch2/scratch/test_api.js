import { GoogleGenerativeAI } from '@google/generative-ai';



async function checkModels() {
  try {
    console.log("Checking API Key validity and available models...");
    
    const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.5-flash-latest'];
    
    for (const m of models) {
        try {
            console.log(`Testing ${m}...`);
            const model = genAI.getGenerativeModel({ model: m }); 
            const result = await model.generateContent("test");
            const response = await result.response;
            console.log(`SUCCESS with ${m}: ${response.text()}`);
            process.exit(0);
        } catch (e) {
            console.log(`FAILED ${m}: ${e.message}`);
        }
    }
    console.log("All models failed.");
    process.exit(1);
  } catch (err) {
    console.error("GLOBAL ERROR:", err);
    process.exit(1);
  }
}

checkModels();
