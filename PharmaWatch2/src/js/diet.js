import { callAI, extractJSON } from './ai.js';
import { supabase, getCurrentUserId } from './supabase.js';

export const initDiet = () => {
  let lastMedsHash = '';

  const loadDiet = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // 1. Get current medicines
    const { data: medicines } = await supabase.from('medicines').select('name, cause').eq('user_id', userId);
    
    if (!medicines || medicines.length === 0) {
      document.getElementById('diet-empty').classList.remove('hidden');
      document.getElementById('diet-results').classList.add('hidden');
      return;
    }

    const medsString = medicines.map(m => `${m.name} (for ${m.cause})`).join(', ');
    
    // Simple deduplication: if the meds haven't changed since last load, don't re-generate
    if (medsString === lastMedsHash) {
      console.log('Medicines unchanged, skipping AI generation');
      return;
    }

    document.getElementById('diet-empty').classList.add('hidden');
    document.getElementById('diet-results').classList.remove('hidden');
    
    // Show loading state
    const loadingHtml = '<span class="material-symbols-outlined animate-spin inline-block text-sm">progress_activity</span> Generating...';
    document.getElementById('diet-eat').innerHTML = loadingHtml;
    document.getElementById('diet-avoid').innerHTML = 'Generating...';
    document.getElementById('diet-hydration').innerHTML = 'Generating...';
    document.getElementById('diet-side-effects').innerHTML = 'Generating...';

    const lang = localStorage.getItem('pharmawatch_lang') || 'en';
    const langNames = { 'en': 'English', 'hi': 'Hindi', 'te': 'Telugu' };
    const targetLang = langNames[lang] || 'English';

    try {
      const prompt = `
        A patient is taking the following medicines: ${medsString}.
        Provide a safe dietary guideline in JSON format with exactly these keys:
        - "eat": String (List of foods recommended to eat)
        - "avoid": String (List of foods to avoid due to interactions)
        - "hydration": String (Hydration advice)
        - "side_effects": String (Common side effects to watch out for)
        
        IMPORTANT: Respond ENTIRELY in ${targetLang}. Keep it simple, empathetic, and elderly-friendly. Only output valid JSON.
      `;

      const text = await callAI(prompt);
      const dietPlan = extractJSON(text);

      document.getElementById('diet-eat').innerText = dietPlan.eat;
      document.getElementById('diet-avoid').innerText = dietPlan.avoid;
      document.getElementById('diet-hydration').innerText = dietPlan.hydration;
      document.getElementById('diet-side-effects').innerText = dietPlan.side_effects;

      lastMedsHash = medsString;

      // Save to Supabase
      await supabase.from('diet_recommendations').upsert({
        user_id: userId,
        eat: dietPlan.eat,
        avoid: dietPlan.avoid,
        hydration: dietPlan.hydration,
        side_effects: dietPlan.side_effects,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    } catch (error) {
      console.error('Diet Gen Error:', error);
      let msg = 'Failed to generate recommendations.';
      if (error.message.includes('QUOTA_EXCEEDED')) {
        const parts = error.message.split('|');
        const detail = parts[1] || "Quota reached.";
        msg = `⚠️ AI quota reached. ${detail}`;
      } else if (error.message.includes('SERVER_BUSY')) {
        msg = `⏳ High Demand. Google's AI is busy. Please try again in a few seconds.`;
      }
      document.getElementById('diet-eat').innerText = msg;
      document.getElementById('diet-avoid').innerText = '';
      document.getElementById('diet-hydration').innerText = '';
      document.getElementById('diet-side-effects').innerText = '';
    }
  };

  window.addEventListener('pharmawatch:login', loadDiet);
  window.addEventListener('pharmawatch:diet_needs_update', () => {
    lastMedsHash = ''; // Reset hash so it forces a re-gen when next viewed
    loadDiet();
  });
  
  document.querySelector('[data-target="diet-screen"]').addEventListener('click', loadDiet);
};

