const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();
tg.BackButton.hide();

// Adjust spacing for Telegram header
const headerOffset = tg.headerColor ? 10 : 0;
if (headerOffset > 0) {
  const spacer = document.querySelector('.spacer-top');
  if (spacer) {
    spacer.style.height = `${70 + headerOffset}px`;
  }
  document.body.style.paddingTop = `${134 + headerOffset}px`;
  const topPanel = document.querySelector('.top-panel');
  if (topPanel) {
    topPanel.style.top = `${70 + headerOffset}px`;
  }
}

const STORAGE_KEY = 'timetrackerkey';
const ACTIVITIES_KEY = 'activities';
const HISTORY_KEY = 'history';

const activitiesList = document.getElementById('activities-list');
const historyList = document.getElementById('history-list');
const historySection = document.getElementById('history-section');
const addButton = document.getElementById('add-activity-btn');
const createModal = document.getElementById('create-modal');
const timeModal = document.getElementById('time-modal');
const deleteModal = document.getElementById('delete-modal');
const deleteHistoryModal = document.getElementById('delete-history-modal');
const createForm = document.getElementById('create-form');
const timeForm = document.getElementById('time-form');
const cancelBtn = document.getElementById('cancel-btn');
const cancelTimeBtn = document.getElementById('cancel-time-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteHistoryBtn = document.getElementById('cancel-delete-history-btn');
const confirmDeleteHistoryBtn = document.getElementById('confirm-delete-history-btn');
const timeModalTitle = document.getElementById('time-modal-title');
const deleteActivityName = document.getElementById('delete-activity-name');
const deleteHistoryText = document.getElementById('delete-history-text');
const toast = document.getElementById('toast');

let activities = [];
let history = [];
let currentActivityId = null;
let deleteActivityId = null;
let deleteHistoryId = null;

// Parse time input (supports 1:30, 1.5, 1,5 formats)
function parseTimeInput(input) {
  if (!input || !input.trim()) return 0;
  
  const cleaned = input.trim().replace(/,/g, '.');
  
  // Check if it contains colon (hours:minutes format)
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    return hours + (minutes / 60);
  }
  
  // Otherwise treat as decimal hours
  return parseFloat(cleaned) || 0;
}

// Format hours to readable string
function formatHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0 && minutes === 0) {
    return '0ч';
  }
  
  if (wholeHours === 0) {
    return `${minutes}м`;
  }
  
  if (minutes === 0) {
    return `${wholeHours}ч`;
  }
  
  return `${wholeHours}ч ${minutes}м`;
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Сегодня';
  } else if (diffDays === 1) {
    return 'Вчера';
  } else if (diffDays < 7) {
    return `${diffDays} дн. назад`;
  } else {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast message
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// Update storage usage
function updateStorageUsage() {
  tg.CloudStorage.getItem(STORAGE_KEY, (err, data) => {
    let usedBytes = 0;
    if (!err && data) {
      usedBytes = new TextEncoder().encode(data).length;
    }
    const totalBytes = 4096;
    const percentage = Math.round((usedBytes / totalBytes) * 100);
    const storageText = `${percentage}% ${usedBytes}b/${totalBytes}b`;
    document.querySelector('.storage-usage').textContent = storageText;
  });
}

// Load data from Telegram Cloud Storage
function loadData() {
  tg.CloudStorage.getItem(STORAGE_KEY, (err, data) => {
    if (!err && data) {
      try {
        const parsed = JSON.parse(data);
        activities = parsed.activities || [];
        history = parsed.history || [];
        
        // Migrate old activities without createdAt
        let needsSave = false;
        activities.forEach(activity => {
          if (!activity.createdAt) {
            activity.createdAt = new Date().toISOString();
            needsSave = true;
          }
        });
        if (needsSave) {
          saveData();
        }
      } catch (e) {
        console.error('Error parsing data:', e);
        activities = [];
        history = [];
      }
    } else {
      activities = [];
      history = [];
    }
    renderActivities();
    renderHistory();
    updateStorageUsage();
    setupEventListeners();
  });
}

// Save data to Telegram Cloud Storage
function saveData() {
  const data = JSON.stringify({ activities, history });
  tg.CloudStorage.setItem(STORAGE_KEY, data, () => {
    renderActivities();
    renderHistory();
    updateStorageUsage();
  });
}

// Setup event listeners
function setupEventListeners() {
  addButton.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    createModal.classList.add('active');
    document.body.classList.add('modal-open');
    createForm.reset();
  });

  createForm.addEventListener('submit', handleCreateActivity);
  timeForm.addEventListener('submit', handleAddTime);

  createModal.querySelector('.cancel-button').addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    createModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    createForm.reset();
  });

  timeModal.querySelector('.cancel-button').addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    timeModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    timeForm.reset();
    currentActivityId = null;
  });

  confirmDeleteBtn.addEventListener('click', handleDeleteActivity);
  cancelDeleteBtn.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    deleteModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    deleteActivityId = null;
  });

  confirmDeleteHistoryBtn.addEventListener('click', handleDeleteHistory);
  cancelDeleteHistoryBtn.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    deleteHistoryModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    deleteHistoryId = null;
  });

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === createModal) {
      tg.HapticFeedback.impactOccurred('light');
      createModal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
    if (e.target === timeModal) {
      tg.HapticFeedback.impactOccurred('light');
      timeModal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  });
}

// Modal functions
function openTimeModal(activityId) {
  const activity = activities.find(a => a.id === activityId);
  if (!activity) return;

  currentActivityId = activityId;
  timeModalTitle.textContent = `Добавить время: ${activity.name}`;
  timeModal.classList.add('active');
  document.body.classList.add('modal-open');
  document.getElementById('time-input').focus();
  tg.HapticFeedback.impactOccurred('light');
}

function openDeleteModal(activityId) {
  const activity = activities.find(a => a.id === activityId);
  if (!activity) return;

  deleteActivityId = activityId;
  deleteActivityName.textContent = `Удалить активность "${activity.name}"?`;
  deleteModal.classList.add('active');
  document.body.classList.add('modal-open');
  tg.HapticFeedback.impactOccurred('medium');
}

function openDeleteHistoryModal(historyId) {
  const historyItem = history.find(h => h.id === historyId);
  if (!historyItem) return;

  deleteHistoryId = historyId;
  const activity = activities.find(a => a.id === historyItem.activityId);
  const activityName = activity ? activity.name : 'Неизвестная активность';
  deleteHistoryText.textContent = `Удалить запись "${activityName} - ${formatHours(historyItem.hours)}"?`;
  deleteHistoryModal.classList.add('active');
  document.body.classList.add('modal-open');
  tg.HapticFeedback.impactOccurred('medium');
}

// Handle create activity
function handleCreateActivity(e) {
  e.preventDefault();
  tg.HapticFeedback.impactOccurred('medium');

  const name = document.getElementById('activity-name').value.trim();
  const targetHours = parseFloat(document.getElementById('target-hours').value);
  const initialTimeInput = document.getElementById('initial-time').value.trim();
  const initialHours = parseTimeInput(initialTimeInput);

  if (!name || targetHours < 0) {
    return;
  }

  const newActivity = {
    id: Date.now().toString(),
    name: name,
    targetHours: targetHours,
    spentHours: initialHours,
    createdAt: new Date().toISOString()
  };

  activities.push(newActivity);
  saveData();
  createModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  createForm.reset();
  showToast('Активность добавлена');
}

// Handle add time
function handleAddTime(e) {
  e.preventDefault();
  tg.HapticFeedback.impactOccurred('medium');

  const timeInput = document.getElementById('time-input').value.trim();
  const totalHours = parseTimeInput(timeInput);

  if (totalHours <= 0 || !currentActivityId) {
    return;
  }

  const activity = activities.find(a => a.id === currentActivityId);
  if (activity) {
    activity.spentHours += totalHours;
    
    // Add to history
    const historyEntry = {
      id: Date.now().toString(),
      activityId: currentActivityId,
      activityName: activity.name,
      hours: totalHours,
      date: new Date().toISOString()
    };
    history.unshift(historyEntry);
    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    
    saveData();
    timeModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    timeForm.reset();
    currentActivityId = null;
    showToast('Время добавлено');
  }
}

// Handle delete activity
function handleDeleteActivity() {
  if (!deleteActivityId) return;

  tg.HapticFeedback.notificationOccurred('success');
  
  // Remove from activities
  activities = activities.filter(a => a.id !== deleteActivityId);
  // Remove from history
  history = history.filter(h => h.activityId !== deleteActivityId);
  
  saveData();
  deleteModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  deleteActivityId = null;
  showToast('Активность удалена');
}

// Handle delete history item
function handleDeleteHistory() {
  if (!deleteHistoryId) return;

  tg.HapticFeedback.notificationOccurred('success');
  
  const historyItem = history.find(h => h.id === deleteHistoryId);
  if (historyItem) {
    // Remove from history
    history = history.filter(h => h.id !== deleteHistoryId);
    
    // Update activity spent hours
    const activity = activities.find(a => a.id === historyItem.activityId);
    if (activity) {
      activity.spentHours = Math.max(0, activity.spentHours - historyItem.hours);
    }
    
    saveData();
  }
  
  deleteHistoryModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  deleteHistoryId = null;
  showToast('Запись удалена');
}

// Render activities
function renderActivities() {
  if (activities.length === 0) {
    activitiesList.innerHTML = '<div class="empty-state">Нажмите + чтобы добавить активность</div>';
    return;
  }

  activitiesList.innerHTML = activities.map(activity => {
    const percentage = activity.targetHours > 0 
      ? Math.min((activity.spentHours / activity.targetHours) * 100, 100) 
      : 0;
    
    const formattedSpent = formatHours(activity.spentHours);
    const formattedTarget = formatHours(activity.targetHours);
    const createdDate = activity.createdAt ? formatDate(activity.createdAt) : '';

    return `
      <div class="activity-card-wrapper">
        <div class="swipe-delete-background"></div>
        <div class="activity-card" data-id="${activity.id}">
          <div class="activity-header">
            <div>
              <div class="activity-name">${escapeHtml(activity.name)}</div>
              ${createdDate ? `<div class="activity-date">${createdDate}</div>` : ''}
            </div>
          </div>
          <div class="stats-container">
            <div class="stat-box target">
              <div class="stat-label">Цель</div>
              <div class="stat-value">${formattedTarget}</div>
            </div>
            <div class="stat-box spent">
              <div class="stat-label">Потрачено</div>
              <div class="stat-value">${formattedSpent}</div>
            </div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar ${percentage < 10 ? 'low' : ''}" style="width: ${Math.max(percentage, 0)}%"></div>
            <span class="progress-percentage">${percentage.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners - click on card to add time
  document.querySelectorAll('.activity-card').forEach(card => {
    const activityId = card.dataset.id;
    
    card.addEventListener('click', () => {
      openTimeModal(activityId);
    });
  });

  // Swipe to delete
  setupSwipeToDelete();
}

// Setup swipe to delete - iOS style
function setupSwipeToDelete() {
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let currentWrapper = null;
  let currentCard = null;
  let startTime = 0;
  let animationFrame = null;

  document.querySelectorAll('.activity-card-wrapper').forEach(wrapper => {
    const card = wrapper.querySelector('.activity-card');
    
    card.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
      currentWrapper = wrapper;
      currentCard = card;
      startTime = Date.now();
      // Remove transition during swipe for smooth movement
      card.style.transition = 'none';
    });

    card.addEventListener('touchmove', (e) => {
      if (!currentWrapper || !currentCard) return;
      
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const diffX = touchStartX - touchX;
      const diffY = Math.abs(touchStartY - touchY);

      // Check if horizontal swipe is dominant
      if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
        isSwiping = true;
        e.preventDefault();
        
        // Cancel any pending animation
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        
        // Only allow left swipe (reveal delete)
        if (diffX > 0) {
          // Use easing for smoother feel
          const maxSwipe = 80;
          const rawTranslate = Math.min(diffX, maxSwipe);
          // Apply easing function for smoother movement
          const easeOut = 1 - Math.pow(1 - (rawTranslate / maxSwipe), 3);
          const translateX = rawTranslate * 0.7 + maxSwipe * 0.3 * easeOut;
          
          currentWrapper.classList.add('swiping');
          currentCard.style.transform = `translateX(-${translateX}px)`;
        } else if (diffX < -10) {
          // Swipe right - reset smoothly
          currentWrapper.classList.remove('swiping');
          currentCard.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          currentCard.style.transform = '';
        }
      }
    });

    card.addEventListener('touchend', (e) => {
      if (!currentWrapper || !currentCard) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;
      const swipeTime = Date.now() - startTime;
      
      // Restore transition for smooth return
      currentCard.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      if (isSwiping) {
        if (diffX > 50 || (diffX > 30 && swipeTime < 200)) {
          // Swipe threshold met, delete activity
          const activityId = currentCard.dataset.id;
          tg.HapticFeedback.impactOccurred('medium');
          // Keep it open for delete
          currentCard.style.transform = 'translateX(-80px)';
          openDeleteModal(activityId);
        } else {
          // Reset position smoothly
          currentWrapper.classList.remove('swiping');
          currentCard.style.transform = '';
        }
      }
      
      isSwiping = false;
      currentWrapper = null;
      currentCard = null;
    });
  });
}

// Render history
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">История пуста</div>';
    return;
  }

  historyList.innerHTML = history.map(item => {
    const formattedTime = formatHours(item.hours);
    const formattedDate = formatDate(item.date);
    const activity = activities.find(a => a.id === item.activityId);
    const activityName = activity ? activity.name : item.activityName || 'Удаленная активность';

    return `
      <div class="history-item-wrapper">
        <div class="swipe-delete-background"></div>
        <div class="history-item" data-id="${item.id}">
          <div class="history-item-content">
            <div class="history-item-name">${escapeHtml(activityName)}</div>
            <div class="history-item-meta">${formattedDate}</div>
          </div>
          <div class="history-item-time">+${formattedTime}</div>
        </div>
      </div>
    `;
  }).join('');

  // Setup swipe to delete for history
  setupHistorySwipeToDelete();
}

// Setup swipe to delete for history - iOS style
function setupHistorySwipeToDelete() {
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let currentWrapper = null;
  let currentItem = null;
  let startTime = 0;
  let hasSwiped = false;

  document.querySelectorAll('.history-item-wrapper').forEach(wrapper => {
    const item = wrapper.querySelector('.history-item');
    
    item.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
      hasSwiped = false;
      currentWrapper = wrapper;
      currentItem = item;
      startTime = Date.now();
      // Remove transition during swipe for smooth movement
      item.style.transition = 'none';
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      if (!currentWrapper || !currentItem) return;
      
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const diffX = touchStartX - touchX;
      const diffY = Math.abs(touchStartY - touchY);

      // Check if horizontal swipe is dominant
      if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
        isSwiping = true;
        hasSwiped = true;
        e.preventDefault();
        
        // Only allow left swipe (reveal delete)
        if (diffX > 0) {
          // Use easing for smoother feel
          const maxSwipe = 80;
          const rawTranslate = Math.min(diffX, maxSwipe);
          // Apply easing function for smoother movement
          const easeOut = 1 - Math.pow(1 - (rawTranslate / maxSwipe), 3);
          const translateX = rawTranslate * 0.7 + maxSwipe * 0.3 * easeOut;
          
          currentWrapper.classList.add('swiping');
          currentItem.style.transform = `translateX(-${translateX}px)`;
        } else if (diffX < -10) {
          // Swipe right - reset smoothly
          currentWrapper.classList.remove('swiping');
          currentItem.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          currentItem.style.transform = '';
        }
      }
    }, { passive: false });

    item.addEventListener('touchend', (e) => {
      if (!currentWrapper || !currentItem) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;
      const swipeTime = Date.now() - startTime;
      
      // Restore transition for smooth return
      currentItem.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      if (isSwiping || hasSwiped) {
        if (diffX > 50 || (diffX > 30 && swipeTime < 200)) {
          // Swipe threshold met, delete history item
          const historyId = currentItem.dataset.id;
          tg.HapticFeedback.impactOccurred('medium');
          // Keep it open for delete
          currentItem.style.transform = 'translateX(-80px)';
          openDeleteHistoryModal(historyId);
        } else {
          // Reset position smoothly
          currentWrapper.classList.remove('swiping');
          currentItem.style.transform = '';
        }
      }
      
      isSwiping = false;
      hasSwiped = false;
      currentWrapper = null;
      currentItem = null;
    }, { passive: true });
  });
}

// Initialize app
loadData();
