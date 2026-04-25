import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyCRs_h1Dlyn4PWVPICMIEsNLQF1HM1xkpg';
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Advanced AI service with automatic model discovery
 */
/**
 * Utility to wait for specified duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Advanced AI service with automatic model discovery and robust retry logic
 */
export const callAI = async (prompt, modelName = null, mediaData = null) => {
  // List of models to try in order of preference
  const modelsToTry = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
    'gemini-1.5-pro'
  ];

  let lastError = null;
  const MAX_RETRIES_PER_MODEL = 2;

  for (const modelId of modelsToTry) {
    let attempts = 0;
    
    while (attempts <= MAX_RETRIES_PER_MODEL) {
      try {
        console.log(`Trying model: ${modelId} (Attempt ${attempts + 1})...`);
        const model = genAI.getGenerativeModel({ model: modelId });
        
        let result;
        if (mediaData) {
          result = await model.generateContent([
            prompt,
            { inlineData: { data: mediaData.data, mimeType: mediaData.mimeType } }
          ]);
        } else {
          result = await model.generateContent(prompt);
        }

        const response = await result.response;
        console.log(`Successfully connected using ${modelId}`);
        return response.text();
        
      } catch (error) {
        lastError = error;
        attempts++;
        
        const errorText = error.message || String(error);
        console.error(`Model ${modelId} failed:`, error);

        // Parse retry delay if available (e.g., from 503 or 429)
        let retryDelayMs = 0;
        try {
          // Attempt to extract delay from error details if they exist in the SDK error
          const details = error.response?.error?.details || error.details;
          if (details) {
            const retryInfo = details.find(d => d['@type']?.includes('RetryInfo'));
            if (retryInfo?.retryDelay) {
              // Convert "47s" or similar to milliseconds
              const seconds = parseInt(retryInfo.retryDelay);
              if (!isNaN(seconds)) retryDelayMs = seconds * 1000;
            }
          }
        } catch (e) {
          console.warn("Failed to parse retry delay from error details", e);
        }

        // If it's a 404 or "not found", it's likely the model doesn't exist, try next model
        if (errorText.includes('404') || errorText.toLowerCase().includes('not found')) {
          console.warn(`Model ${modelId} not found. Skipping.`);
          break; // Exit while loop, move to next model
        }

        // Handle Quota (429)
        if (errorText.includes('429') || errorText.toLowerCase().includes('quota')) {
          if (errorText.includes('limit: 0') || errorText.includes('PerModel')) {
            console.warn(`Model ${modelId} has no quota. Trying next model...`);
            break; 
          }
          
          if (errorText.toLowerCase().includes('daily')) {
            throw new Error(`QUOTA_EXCEEDED|You've reached the DAILY limit. Please try again tomorrow.`);
          }

          // Per-minute limit: Wait and retry if we have attempts left
          const waitTime = retryDelayMs || (attempts * 20000); // 20s, 40s...
          console.warn(`Quota hit for ${modelId}. Waiting ${waitTime/1000}s before retry...`);
          await sleep(waitTime);
          continue; 
        }

        // Handle Capacity/Busy (503)
        if (errorText.includes('503') || errorText.includes('CAPACITY_EXHAUSTED') || errorText.includes('UNAVAILABLE')) {
          const waitTime = retryDelayMs || 47000; // Default to 47s as requested by user's error trace
          console.warn(`Capacity exhausted for ${modelId}. Waiting ${waitTime/1000}s...`);
          await sleep(waitTime);
          continue;
        }

        // Auth errors are fatal
        if (errorText.includes('403') || errorText.includes('401') || errorText.toLowerCase().includes('api key')) {
          throw new Error(`AUTH_FAILED|API Key issue: ${errorText}`);
        }

        // For other errors, try one more time then move on
        if (attempts <= MAX_RETRIES_PER_MODEL) {
          await sleep(2000);
          continue;
        }
        break;
      }
    }
  }

  // If we reach here, all models failed
  const finalError = lastError?.message || 'Unknown error';
  throw new Error(`CONNECTION_FAILED|All Gemini models failed. Last error: ${finalError}`);
};


export const extractJSON = (text) => {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) {
    throw new Error("Invalid AI response format.");
  }
};
