import { callAI } from '../src/js/ai.js';

async function testAI() {
  try {
    console.log("Testing AI connection...");
    const response = await callAI("Say 'Connection successful' if you can hear me.");
    console.log("AI RESPONSE:", response);
  } catch (err) {
    console.error("AI TEST FAILED:", err);
  }
}

testAI();
