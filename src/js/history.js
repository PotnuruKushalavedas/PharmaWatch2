import { supabase, getCurrentUserId } from './supabase.js';

export const initHistory = () => {
  const loadHistory = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    // Fetch history
    const { data: history } = await supabase
      .from('medicine_history')
      .select('*, medicines(name, cause), time_slots(time_string)')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50); // Last 50 entries

    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (!history || history.length === 0) {
      list.innerHTML = '<p class="text-center text-gray-500 py-10">No history available yet.</p>';
      document.getElementById('adherence-text').innerText = '0%';
      document.getElementById('adherence-bar').style.width = '0%';
      return;
    }

    // Calculate Adherence for today
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = history.filter(h => h.date === today);
    const totalToday = todayHistory.length;
    const takenToday = todayHistory.filter(h => h.status === 'taken').length;
    
    let adherence = 0;
    if (totalToday > 0) {
      adherence = Math.round((takenToday / totalToday) * 100);
    }
    
    document.getElementById('adherence-text').innerText = `${adherence}%`;
    document.getElementById('adherence-bar').style.width = `${adherence}%`;

    // Group by date
    const grouped = {};
    history.forEach(h => {
      if (!grouped[h.date]) grouped[h.date] = [];
      grouped[h.date].push(h);
    });

    for (const [date, items] of Object.entries(grouped)) {
      // Format date
      const d = new Date(date);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      
      let html = `<h4 class="text-lg font-bold text-gray-500 mt-6 mb-3 px-2">${dateStr}</h4><div class="space-y-3">`;
      
      items.forEach(h => {
        const medName = h.medicines ? h.medicines.name : 'Unknown';
        const cause = h.medicines ? h.medicines.cause : '';
        const timeStr = h.time_slots ? h.time_slots.time_string : '';
        const timestamp = new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let icon = 'help';
        let colorClass = 'text-gray-400 bg-gray-100';
        let label = h.status;
        
        if (h.status === 'taken') {
          icon = 'check_circle';
          colorClass = 'text-healthcare-green bg-green-50 border-green-200';
        } else if (h.status === 'missed') {
          icon = 'cancel';
          colorClass = 'text-healthcare-red bg-red-50 border-red-200';
        } else if (h.status === 'snoozed') {
          icon = 'snooze';
          colorClass = 'text-yellow-600 bg-yellow-50 border-yellow-200';
        }

        html += `
          <div class="flex items-center justify-between p-4 rounded-2xl border ${colorClass}">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-3xl">${icon}</span>
              <div>
                <h3 class="font-bold text-gray-800">${medName} <span class="text-sm font-normal text-gray-500 ml-1">(${timeStr})</span></h3>
                <p class="text-sm opacity-80">${cause}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="block font-bold capitalize">${label}</span>
              <span class="text-xs opacity-70">${timestamp}</span>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      list.insertAdjacentHTML('beforeend', html);
    }
  };

  window.addEventListener('pharmawatch:login', loadHistory);
  window.addEventListener('pharmawatch:history_updated', loadHistory);
  document.querySelector('[data-target="history-screen"]').addEventListener('click', loadHistory);
};
