/* Lafayette Homes — AI Chat Widget */
(function () {
  'use strict';

  const CHAT_ENDPOINT = '/api/chat';
  const STORAGE_KEY = 'lh-chat-history';

  const WELCOME = {
    role: 'assistant',
    content: "Hey there! 👋 I'm the Lafayette Homes assistant. I can answer questions about our available homes, floor plans, pricing, or the build process — and help you set up a tour with Kara.\n\nWhat can I help you with?"
  };

  const QUICK_REPLIES = [
    "What homes are available?",
    "Tell me about floor plans",
    "How does the build process work?",
    "I'd like to schedule a tour",
  ];

  let messages = [];
  let isOpen = false;
  let isTyping = false;
  let quickShown = false;

  function init() {
    injectHTML();
    bindEvents();
    loadHistory();
    setTimeout(() => {
      if (!isOpen && !sessionStorage.getItem('lh-chat-opened')) {
        const dot = document.querySelector('.notif-dot');
        if (dot) dot.classList.remove('hidden');
      }
    }, 4000);
  }

  function injectHTML() {
    const el = document.createElement('div');
    el.id = 'lh-chat-root';
    el.innerHTML = `
      <button class="chat-bubble" id="chat-bubble" aria-label="Open chat" aria-expanded="false">
        <span class="bubble-icon" aria-hidden="true">💬</span>
        <span class="bubble-close" aria-hidden="true">✕</span>
        <span class="notif-dot hidden" aria-hidden="true"></span>
      </button>
      <div class="chat-drawer" id="chat-drawer" role="dialog" aria-label="Lafayette Homes chat">
        <div class="chat-header">
          <div class="chat-header-avatar" aria-hidden="true">🏡</div>
          <div class="chat-header-info">
            <div class="chat-header-name">Lafayette Homes</div>
            <div class="chat-header-status">Online — typically replies instantly</div>
          </div>
        </div>
        <div class="chat-messages" id="chat-messages" aria-live="polite"></div>
        <div class="chat-quick-replies" id="chat-quick-replies"></div>
        <div class="chat-input-area">
          <textarea class="chat-input" id="chat-input" placeholder="Ask about homes, pricing, plans…" rows="1" aria-label="Chat message" maxlength="600"></textarea>
          <button class="chat-send" id="chat-send" aria-label="Send">➤</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }

  function bindEvents() {
    document.getElementById('chat-bubble').addEventListener('click', toggleDrawer);
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 90) + 'px';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) toggleDrawer(); });
  }

  function toggleDrawer() {
    isOpen = !isOpen;
    const bubble = document.getElementById('chat-bubble');
    const drawer = document.getElementById('chat-drawer');
    bubble.classList.toggle('open', isOpen);
    bubble.setAttribute('aria-expanded', isOpen);
    drawer.classList.toggle('open', isOpen);
    document.querySelector('.notif-dot')?.classList.add('hidden');
    sessionStorage.setItem('lh-chat-opened', '1');
    if (isOpen) {
      if (messages.length === 0) { addMessage(WELCOME.role, WELCOME.content); showQuickReplies(); }
      setTimeout(() => { document.getElementById('chat-input')?.focus(); scrollToBottom(); }, 250);
    }
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || isTyping) return;

    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('chat-quick-replies').innerHTML = '';
    quickShown = true;
    showTyping();
    disableInput(true);

    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'API error');
      messages.push({ role: 'assistant', content: data.reply });
      hideTyping();
      addMessage('assistant', data.reply);
      saveHistory();
    } catch (err) {
      hideTyping();
      addMessage('assistant', "Sorry, I hit an issue. Please call us at **(864) 756-1313** or email info@buildwithlafayette.com.");
      console.error('Chat error:', err);
    }
    disableInput(false);
    document.getElementById('chat-input')?.focus();
  }

  function addMessage(role, content) {
    const container = document.getElementById('chat-messages');
    const isUser = role === 'user';
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isUser ? 'user' : 'assistant'}`;
    msg.innerHTML = `
      <div class="chat-msg-avatar" aria-hidden="true">${isUser ? '👤' : '🏡'}</div>
      <div class="chat-msg-bubble">${formatContent(content)}</div>`;
    container.appendChild(msg);
    scrollToBottom();
  }

  function formatContent(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/\n/g,'<br>')
      .replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\((\d{3})\)\s*(\d{3}-\d{4})/g,'<a href="tel:+1$1$2">($1) $2</a>');
  }

  function showTyping() {
    isTyping = true;
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg assistant chat-typing'; el.id = 'chat-typing';
    el.innerHTML = `<div class="chat-msg-avatar" aria-hidden="true">🏡</div><div class="chat-msg-bubble"><div class="typing-dots" aria-label="Typing"><span></span><span></span><span></span></div></div>`;
    container.appendChild(el); scrollToBottom();
  }

  function hideTyping() { isTyping = false; document.getElementById('chat-typing')?.remove(); }

  function disableInput(disabled) {
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('chat-send');
    if (input) input.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  function scrollToBottom() {
    const c = document.getElementById('chat-messages');
    if (c) c.scrollTop = c.scrollHeight;
  }

  function showQuickReplies() {
    if (quickShown) return;
    const container = document.getElementById('chat-quick-replies');
    if (!container) return;
    container.innerHTML = QUICK_REPLIES.map(q => `<button class="chat-chip" type="button">${q}</button>`).join('');
    container.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        if (input) input.value = chip.textContent;
        sendMessage();
      });
    });
  }

  function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); } catch(_) {}
  }

  function loadHistory() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.length) return;
      messages = parsed;
      document.getElementById('chat-bubble').addEventListener('click', function onFirst() {
        if (messages.length > 0 && !document.getElementById('chat-messages').children.length) {
          messages.forEach(m => addMessage(m.role, m.content));
          scrollToBottom();
        }
        this.removeEventListener('click', onFirst);
      });
    } catch(_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
