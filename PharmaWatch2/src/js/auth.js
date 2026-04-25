import { supabase } from './supabase.js';
import { navigateTo } from './ui.js';
import { applyLanguage } from './i18n.js';

export const initAuth = () => {
  const form = document.getElementById('login-form');
  const nameInput = document.getElementById('name');
  const ageInput = document.getElementById('age');
  const genderInput = document.getElementById('gender');
  const loginBtn = document.getElementById('login-btn');
  const langSelect = document.getElementById('language-selector');

  // Logout Logic - Must be before early return!
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      // Reset form state
      nameInput.value = '';
      ageInput.value = '';
      genderInput.value = '';
      loginBtn.disabled = true;
      loginBtn.innerText = 'Start Using App';
      
      // Navigate immediately for instant feedback
      navigateTo('landing-screen');
    });
  }

  // Check if already logged in
  const userId = localStorage.getItem('pharmawatch_user_id');
  if (userId) {
    const lang = localStorage.getItem('pharmawatch_lang') || 'en';
    langSelect.value = lang;
    applyLanguage(lang);
    navigateTo('home-screen');
    return;
  } else {
    navigateTo('landing-screen');
  }

  // Enable button only when all fields filled
  const checkForm = () => {
    if (nameInput.value.trim() !== '' && ageInput.value !== '' && genderInput.value !== '') {
      loginBtn.disabled = false;
    } else {
      loginBtn.disabled = true;
    }
  };

  nameInput.addEventListener('input', checkForm);
  ageInput.addEventListener('input', checkForm);
  genderInput.addEventListener('change', checkForm);
  
  langSelect.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.innerText = 'Entering...';

    const name = nameInput.value.trim();
    const age = parseInt(ageInput.value, 10);
    const gender = genderInput.value;
    const lang = langSelect.value;

    const saveSession = (id, name, lang) => {
      localStorage.setItem('pharmawatch_user_id', id);
      localStorage.setItem('pharmawatch_user_name', name);
      localStorage.setItem('pharmawatch_lang', lang);
      applyLanguage(lang);
      window.dispatchEvent(new Event('pharmawatch:login'));
    };

    try {
      // 1. First, check if a user with this name already exists (Allow re-entry)
      let { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .maybeSingle();

      if (fetchError) {
        console.warn('Supabase fetch error:', fetchError.message || fetchError);
        console.debug('Full error object:', fetchError);
      }

      if (existingUser) {
        console.log('Existing user found, logging in...');
        saveSession(existingUser.id, existingUser.name, existingUser.language || lang);
        navigateTo('home-screen');
        return;
      }

      // 2. If not existing, try to create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ name, age, gender, language: lang }])
        .select()
        .single();

      if (insertError) throw insertError;

      saveSession(newUser.id, newUser.name, newUser.language);
      navigateTo('home-screen');

    } catch (err) {
      console.warn('Database connection failed, entering in LOCAL MODE:', err);
      // FALLBACK: If database fails, still let them enter using a temporary local ID
      const localId = 'local_' + Math.random().toString(36).substr(2, 9);
      saveSession(localId, name, lang);
      navigateTo('home-screen');
    }
  });
};
