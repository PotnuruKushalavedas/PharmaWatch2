import { callAI } from './ai.js';

export const initChatbot = () => {
  const fab = document.getElementById('chatbot-fab');
  const modal = document.getElementById('chatbot-modal');
  const container = document.getElementById('chatbot-container');
  const closeBtn = document.getElementById('close-chatbot');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const messagesDiv = document.getElementById('chat-messages');

  const toggleChat = (show) => {
    if (show) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      // Slide up animation
      setTimeout(() => {
        container.classList.remove('translate-y-full');
      }, 10);
    } else {
      container.classList.add('translate-y-full');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }, 300); // match transition duration
    }
  };

  fab.addEventListener('click', () => toggleChat(true));
  closeBtn.addEventListener('click', () => toggleChat(false));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) toggleChat(false);
  });

  const appendMessage = (text, isUser) => {
    const div = document.createElement('div');
    div.className = `flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`;
    
    let avatar = isUser 
      ? '<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-blue-600 text-sm">person</span></div>'
      : '<div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-primary-600 text-sm">smart_toy</span></div>';
      
    let bubbleClass = isUser 
      ? 'bg-primary-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-lg max-w-[80%]'
      : 'bg-white text-gray-700 p-3 rounded-2xl rounded-tl-none shadow-sm text-lg max-w-[80%]';

    div.innerHTML = `
      ${avatar}
      <div class="${bubbleClass}">${text}</div>
    `;
    
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    appendMessage(query, true);
    input.value = '';
    
    // Add a loading indicator
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'flex gap-2';
    loadingDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined text-primary-600 text-sm">smart_toy</span>
      </div>
      <div class="bg-white text-gray-500 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center">
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
      </div>
    `;
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      const systemPrompt = "You are a helpful healthcare AI assistant specifically designed for an app for elderly users. You must ONLY answer questions related to medicines, health, diet, and prescriptions. If the user asks anything unrelated to healthcare or medicines, politely decline to answer. Keep answers concise and easy to understand.";
      
      const prompt = `${systemPrompt}\n\nUser: ${query}`;
      
      const responseText = await callAI(prompt);
      
      document.getElementById(loadingId).remove();
      appendMessage(responseText, false);
      
    } catch (error) {
      document.getElementById(loadingId).remove();
      
      let errorMsg = "Sorry, I'm having trouble connecting right now.";
      const errorText = error.message || String(error);

      if (errorText.includes('|')) {
        const [code, detail] = errorText.split('|');
        
        if (code === 'QUOTA_EXCEEDED') {
          errorMsg = `⚠️ Limit reached. ${detail}`;
        } else if (code === 'AUTH_FAILED') {
          errorMsg = `🔑 Connection issue. There seems to be a problem with the AI key.`;
        } else if (code === 'CONNECTION_FAILED') {
          errorMsg = `⏳ All AI models are currently busy or unavailable. Please try again in a minute.`;
        } else {
          errorMsg = detail || errorMsg;
        }
      } else if (errorText.includes('503') || errorText.includes('CAPACITY')) {
        errorMsg = `⏳ High Demand! Google's AI is currently very busy. Please try asking again in a few seconds.`;
      }
      
      appendMessage(errorMsg, false);
      console.error("AI Error:", error);
    }

  });
};

