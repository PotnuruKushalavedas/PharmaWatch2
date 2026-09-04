import { supabase, getCurrentUserId } from './supabase.js';
import { getTranslation } from './i18n.js';

let activeAlarms = {}; // Tracks slots currently ringing or snoozed
let audioContext = null;
let oscillator = null;
let checkInterval = null;

const playAlarmSound = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (oscillator) return; // Already playing

  oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
  
  // Beep pattern
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start();
  // Loop beep manually using interval if needed, or rely on UI animations
  // For web, a simple beep repeated:
  const beepInterval = setInterval(() => {
    if(!oscillator) {
      clearInterval(beepInterval);
      return;
    }
    const g = audioContext.createGain();
    const o = audioContext.createOscillator();
    o.frequency.value = 880;
    o.connect(g);
    g.connect(audioContext.destination);
    g.gain.setValueAtTime(0, audioContext.currentTime);
    g.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.1);
    g.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    o.start();
    o.stop(audioContext.currentTime + 0.5);
  }, 1000);
  
  oscillator.onended = () => clearInterval(beepInterval);
};

const stopAlarmSound = () => {
  if (oscillator) {
    try { oscillator.stop(); } catch(e){}
    oscillator.disconnect();
    oscillator = null;
  }
};

const recordHistory = async (slotId, medId, status) => {
  const userId = getCurrentUserId();
  const today = new Date().toISOString().split('T')[0];
  
  // Check if history already exists for today to avoid duplicates
  const { data: existing } = await supabase
    .from('medicine_history')
    .select('id')
    .eq('time_slot_id', slotId)
    .eq('date', today)
    .single();
    
  if (existing) {
    await supabase
      .from('medicine_history')
      .update({ status, timestamp: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('medicine_history')
      .insert([{
        user_id: userId,
        medicine_id: medId,
        time_slot_id: slotId,
        status: status,
        date: today
      }]);
  }
  
  window.dispatchEvent(new Event('pharmawatch:history_updated'));
};

const showAlarmUI = (slot, medicine) => {
  document.getElementById('alarm-time').innerText = slot.time_string;
  document.getElementById('alarm-medicine').innerText = medicine.name;
  document.getElementById('alarm-cause').innerText = medicine.cause;
  
  const overlay = document.getElementById('alarm-overlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  
  playAlarmSound();
  
  // Handlers
  const okBtn = document.getElementById('alarm-ok-btn');
  const snoozeBtn = document.getElementById('alarm-snooze-btn');
  
  // Remove old listeners by cloning
  const newOk = okBtn.cloneNode(true);
  const newSnooze = snoozeBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  snoozeBtn.parentNode.replaceChild(newSnooze, snoozeBtn);
  
  newOk.addEventListener('click', () => {
    stopAlarmSound();
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    activeAlarms[slot.id] = { state: 'taken' };
    recordHistory(slot.id, medicine.id, 'taken');
    renderRemindersList();
  });
  
  newSnooze.addEventListener('click', () => {
    stopAlarmSound();
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    activeAlarms[slot.id] = { 
      state: 'snoozed', 
      snoozeUntil: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    };
    recordHistory(slot.id, medicine.id, 'snoozed');
    renderRemindersList();
  });
  
  // 5 minute auto-timeout if ignored
  setTimeout(() => {
    if (activeAlarms[slot.id] && activeAlarms[slot.id].state === 'ringing') {
      stopAlarmSound();
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      
      // Auto snooze or miss logic
      const timesIgnored = activeAlarms[slot.id].ignoredCount || 0;
      if (timesIgnored === 0) {
        // First ignore -> auto snooze 1 hr
        activeAlarms[slot.id] = { 
          state: 'snoozed', 
          snoozeUntil: new Date(Date.now() + 60 * 60 * 1000),
          ignoredCount: 1
        };
      } else if (timesIgnored === 1) {
        // Second time ring continuously for 10 min (handled in check loop)
        activeAlarms[slot.id].ignoredCount = 2;
      } else {
        // Mark missed
        activeAlarms[slot.id] = { state: 'missed' };
        recordHistory(slot.id, medicine.id, 'missed');
      }
      renderRemindersList();
    }
  }, 5 * 60 * 1000);
};

export const initReminders = () => {
  const loadAndCheck = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data: medicines } = await supabase.from('medicines').select('*').eq('user_id', userId);
    const { data: slots } = await supabase.from('time_slots').select('*').eq('user_id', userId);
    
    if (!slots || !medicines) return;

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const today = now.toISOString().split('T')[0];

    // Get today's history to know what's already taken/missed
    const { data: history } = await supabase
      .from('medicine_history')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today);

    slots.forEach(slot => {
      const med = medicines.find(m => m.id === slot.medicine_id);
      if (!med) return;

      const hist = history?.find(h => h.time_slot_id === slot.id);
      
      // If already taken or missed permanently today, ignore
      if (hist && (hist.status === 'taken' || hist.status === 'missed')) return;

      // Initialize state tracking
      if (!activeAlarms[slot.id]) {
        activeAlarms[slot.id] = { state: 'pending' };
      }

      const alarmState = activeAlarms[slot.id];

      // Exact time match
      if (slot.time_string === currentTimeStr && alarmState.state === 'pending') {
        alarmState.state = 'ringing';
        showAlarmUI(slot, med);
      }
      
      // Check snooze expiration
      if (alarmState.state === 'snoozed' && alarmState.snoozeUntil && now >= alarmState.snoozeUntil) {
        alarmState.state = 'ringing';
        showAlarmUI(slot, med);
      }
    });
    
    renderRemindersList(slots, medicines, history);
  };

  // Run every minute at the top of the minute
  const startEngine = () => {
    if (checkInterval) clearInterval(checkInterval);
    loadAndCheck();
    checkInterval = setInterval(loadAndCheck, 60000);
  };

  window.addEventListener('pharmawatch:login', startEngine);
  window.addEventListener('pharmawatch:slots_updated', loadAndCheck);

  if (getCurrentUserId()) {
    startEngine();
  }
};

export const renderRemindersList = async (slotsData, medicinesData, historyData) => {
  const userId = getCurrentUserId();
  if (!userId) return;

  let slots = slotsData;
  let medicines = medicinesData;
  let history = historyData;

  if (!slots) {
    const res1 = await supabase.from('time_slots').select('*').eq('user_id', userId).order('time_string');
    slots = res1.data;
  }
  if (!medicines) {
    const res2 = await supabase.from('medicines').select('*').eq('user_id', userId);
    medicines = res2.data;
  }
  if (!history) {
    const today = new Date().toISOString().split('T')[0];
    const res3 = await supabase.from('medicine_history').select('*').eq('user_id', userId).eq('date', today);
    history = res3.data;
  }

  const container = document.getElementById('reminder-list');
  if(!container) return;
  container.innerHTML = '';

  if (!slots || slots.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 py-10">No reminders set.</p>';
    return;
  }

  // Sort by time
  slots.sort((a, b) => a.time_string.localeCompare(b.time_string));

  slots.forEach(slot => {
    const med = medicines.find(m => m.id === slot.medicine_id);
    if (!med) return;

    const hist = history?.find(h => h.time_slot_id === slot.id);
    let statusColor = 'bg-gray-300';
    let statusKey = 't-pending';
    
    if (hist) {
      if (hist.status === 'taken') { statusColor = 'bg-healthcare-green'; statusKey = 't-taken'; }
      if (hist.status === 'missed') { statusColor = 'bg-healthcare-red'; statusKey = 't-missed'; }
      if (hist.status === 'snoozed') { statusColor = 'bg-yellow-400'; statusKey = 't-snoozed'; }
    } else if (activeAlarms[slot.id]?.state === 'ringing') {
      statusColor = 'bg-primary-500 animate-pulse'; statusKey = 't-ringing';
    }

    const statusText = getTranslation(statusKey);

    const html = `
      <div class="card flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-4 h-4 rounded-full ${statusColor}"></div>
          <div>
            <h3 class="text-xl font-bold text-gray-800">${med.name}</h3>
            <p class="text-gray-500">${med.cause} • ${statusText}</p>
          </div>
        </div>
        <div class="text-2xl font-bold text-primary-700">
          ${slot.time_string}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
};
