import { supabase, getCurrentUserId } from './supabase.js';
import { getTranslation } from './i18n.js';

// Convert instructions to standard times
const mapInstructionToTimes = (instruction) => {
  const i = instruction.toLowerCase();
  
  if (i.includes('before breakfast') || i.includes('morning')) return ['07:00'];
  if (i.includes('after breakfast')) return ['09:00'];
  if (i.includes('before lunch')) return ['11:00'];
  if (i.includes('after lunch')) return ['13:00']; // 1:00 PM
  if (i.includes('before dinner') || i.includes('evening')) return ['19:00'];
  if (i.includes('after dinner') || i.includes('night')) return ['21:00'];
  
  if (i.includes('thrice') || i.includes('3 times')) return ['08:00', '13:00', '20:00'];
  if (i.includes('twice') || i.includes('2 times')) return ['09:00', '21:00'];
  if (i.includes('once') || i.includes('1 time')) return ['09:00'];
  
  if (i.includes('every 6 hours')) return ['06:00', '12:00', '18:00', '00:00'];
  if (i.includes('every 8 hours')) return ['08:00', '16:00', '00:00'];
  if (i.includes('every 12 hours')) return ['08:00', '20:00'];
  
  // Default fallback
  return ['09:00'];
};

export const processPrescriptionData = async (medicinesList) => {
  const userId = getCurrentUserId();
  if (!userId) {
    alert('User not logged in. Please log in first.');
    return;
  }

  // Robust array extraction
  let list = medicinesList;
  if (!Array.isArray(list)) {
    if (list.medicines && Array.isArray(list.medicines)) {
      list = list.medicines;
    } else if (list.data && Array.isArray(list.data)) {
      list = list.data;
    } else {
      console.error('Invalid medicine list format:', list);
      alert('AI returned data in an unexpected format. No medicines could be added.');
      return;
    }
  }

  if (list.length === 0) {
    alert('No medicines were found in this prescription.');
    return;
  }

  let successCount = 0;

  let lastError = null;

  for (const med of list) {
    try {
      // 1. Insert Medicine
      const { data: medData, error: medError } = await supabase
        .from('medicines')
        .insert([{ 
          user_id: userId, 
          name: med.name || 'Unknown Medicine', 
          cause: med.cause || 'General' 
        }])
        .select()
        .single();

      if (medError) {
        console.error('Error inserting medicine:', medError);
        lastError = medError.message || JSON.stringify(medError);
        continue;
      }

      // 2. Generate and Insert Time Slots
      const times = mapInstructionToTimes(med.instruction || '');
      
      for (const timeStr of times) {
        const { error: slotError } = await supabase
          .from('time_slots')
          .insert([{
            user_id: userId,
            medicine_id: medData.id,
            time_string: timeStr
          }]);
        
        if (slotError) {
          console.error('Error inserting slot:', slotError);
          lastError = slotError.message;
        }
      }
      successCount++;
    } catch (err) {
      console.error('Process error for med:', med, err);
      lastError = err.message;
    }
  }

  if (successCount > 0) {
    // Trigger global update events
    window.dispatchEvent(new Event('pharmawatch:slots_updated'));
    window.dispatchEvent(new Event('pharmawatch:diet_needs_update'));
    alert(`Successfully added ${successCount} medicines to your schedule!`);
  } else {
    alert('Failed to add medicines: ' + (lastError || 'Unknown error. Please check if your database tables are created.'));
  }
};

// UI rendering for Time Slots
export const initSlotsUI = async () => {
  const loadSlots = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // Fetch medicines and their slots
    const { data: medicines } = await supabase
      .from('medicines')
      .select('id, name, cause')
      .eq('user_id', userId);

    const { data: slots } = await supabase
      .from('time_slots')
      .select('id, medicine_id, time_string')
      .eq('user_id', userId)
      .order('time_string', { ascending: true });

    const container = document.getElementById('slots-list');
    container.innerHTML = '';

    if (!medicines || medicines.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-500 py-10">No time slots yet. Scan a prescription to add medicines.</p>';
      return;
    }

    // Group slots by medicine to allow independent editing
    for (const med of medicines) {
      const medSlots = slots.filter(s => s.medicine_id === med.id);
      
      const card = document.createElement('div');
      card.className = 'card';
      
      let html = `
        <h3 class="text-2xl font-bold text-primary-700">${med.name}</h3>
        <p class="text-gray-500 mb-4 text-lg">${getTranslation('t-cause')}: ${med.cause}</p>
        <div class="space-y-3">
      `;
      
      for (const slot of medSlots) {
        html += `
          <div class="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span class="material-symbols-outlined text-gray-400">schedule</span>
            <input type="time" class="slot-time-input bg-transparent border-b-2 border-primary-200 focus:border-primary-500 outline-none text-xl font-medium text-gray-800" 
                   value="${slot.time_string}" 
                   data-slot-id="${slot.id}">
          </div>
        `;
      }
      
      html += `</div>`;
      card.innerHTML = html;
      container.appendChild(card);
    }

    // Add event listeners for time changes
    document.querySelectorAll('.slot-time-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const slotId = e.target.dataset.slotId;
        const newTime = e.target.value;
        
        await supabase
          .from('time_slots')
          .update({ time_string: newTime })
          .eq('id', slotId);
          
        window.dispatchEvent(new Event('pharmawatch:slots_updated'));
      });
    });
  };

  window.addEventListener('pharmawatch:login', loadSlots);
  window.addEventListener('pharmawatch:slots_updated', loadSlots);
  
  if (getCurrentUserId()) {
    loadSlots();
  }
};
