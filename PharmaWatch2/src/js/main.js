import { initNavigation } from './ui.js';
import { initAuth } from './auth.js';
import { initScanner } from './scanner.js';
import { initSlotsUI } from './scheduler.js';
import { initReminders } from './reminders.js';
import { initDiet } from './diet.js';
import { initChatbot } from './chatbot.js';
import { initHistory } from './history.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initNavigation();
  initChatbot();

  // Initialize Modules
  initScanner();
  initSlotsUI();
  initReminders();
  initDiet();
  initHistory();
  
  // Initialize Auth (this will trigger routing based on state)
  initAuth();
});
