import { callAI, extractJSON } from './ai.js';
import { showLoading, hideLoading, navigateTo } from './ui.js';
import { processPrescriptionData } from './scheduler.js';

export const initScanner = () => {
  const uploadInput = document.getElementById('prescription-upload');
  const previewImg = document.getElementById('scanned-image-preview');
  const processBtn = document.getElementById('process-scan-btn');
  let selectedFile = null;

  uploadInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.classList.remove('hidden');
        processBtn.classList.remove('hidden');
      };
      reader.readAsDataURL(selectedFile);
    }
  });

  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    showLoading('process-scan-btn', 'Analyzing...');
    document.getElementById('scan-loading').classList.remove('hidden');
    document.getElementById('scanner-area').classList.add('hidden');
    processBtn.classList.add('hidden');
    
    try {
      // Convert file to base64 for Gemini
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(selectedFile);
      });

      const prompt = `
        Analyze this medical prescription. Extract the medicines, the cause/reason for the medicine if present (or guess from the medicine name), and the dosage frequency instructions.
        Format the output EXACTLY as a JSON array of objects with the following keys:
        - "name": String (Name of the medicine)
        - "cause": String (Reason for taking it, e.g., "Fever", "Diabetes")
        - "instruction": String (Raw frequency instruction like "twice daily", "after lunch", "every 8 hours")
        Only output valid JSON. No markdown backticks.
      `;

      const text = await callAI(prompt, undefined, {
        data: base64Data,
        mimeType: selectedFile.type
      });

      const parsedData = extractJSON(text);
      
      // Send to scheduler
      await processPrescriptionData(parsedData);
      
      // Reset scanner
      previewImg.classList.add('hidden');
      selectedFile = null;
      
      navigateTo('slots-screen');
      
    } catch (error) {
      console.error('OCR Error:', error);
      
      let errorMsg = "Sorry, I'm having trouble analyzing the image right now.";
      const errorText = error.message || String(error);

      if (errorText.includes('|')) {
        const [code, detail] = errorText.split('|');
        
        if (code === 'QUOTA_EXCEEDED') {
          errorMsg = `⚠️ AI Quota Limit\n\n${detail}`;
        } else if (code === 'AUTH_FAILED') {
          errorMsg = `🔑 API Key Issue\n\nThere is a problem with the AI connection key. Please contact support or check your Google Cloud settings.`;
        } else if (code === 'CONNECTION_FAILED') {
          errorMsg = `⏳ High Demand!\n\nAll AI models are currently busy or unavailable. This usually clears up in a minute. Please try again later.`;
        } else {
          errorMsg = detail || errorMsg;
        }
      } else if (errorText.includes('503') || errorText.includes('CAPACITY')) {
        errorMsg = `⏳ High Demand!\n\nGoogle's AI is currently very busy. Please try asking again in a few seconds.`;
      }
      
      alert(errorMsg);
      processBtn.classList.remove('hidden');
      document.getElementById('scanner-area').classList.remove('hidden');
    } finally {

      hideLoading('process-scan-btn');
      document.getElementById('scan-loading').classList.add('hidden');
    }
  });
};

