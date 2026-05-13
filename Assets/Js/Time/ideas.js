/**
 * Time Application - Ideas Module
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  const { state } = App;
  
  App.mentionState = { active: false, query: '', node: null, offset: 0, selectedIndex: 0, items: [] };

  App.initRichEditor = function() {
    const editor = document.getElementById('idea-editor');
    if (!editor) return;

    editor.addEventListener('keydown', App.handleEditorKeydown);
    editor.addEventListener('input', App.handleEditorInput);
    
    editor.classList.add('whitespace-pre-wrap');
    App.bindMentionListeners(editor);
    
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        App.submitIdea();
      }
    });
    
    editor.addEventListener('input', () => {
      const el = document.getElementById('idea-char-count');
      if (el) el.textContent = editor.innerText.length + ' chars';
    });

    const dropdown = document.getElementById('mention-dropdown');
    if (dropdown) {
      dropdown.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.mention-item');
        if (item) {
          e.preventDefault();
          const idx = parseInt(item.getAttribute('data-mention-idx'));
          if (!isNaN(idx) && App.mentionState.items[idx]) {
            App.insertTagPill(App.mentionState.items[idx]);
          }
        }
      });
    }
  };

  App.bindMentionListeners = function(editor) {
    editor.addEventListener('input', App.handleEditorInput);
    editor.addEventListener('keydown', App.handleEditorKeydown);
    editor.addEventListener('keydown', App.handleAtomicDelete);
    editor.addEventListener('click', App.handleEditorInput);
    editor.addEventListener('blur', () => setTimeout(App.closeMentionDropdown, 200));

    editor.addEventListener('mouseover', (e) => {
      const pill = e.target.closest('[data-type]');
      if (pill) App.showTagTooltip(pill, editor);
    });
    editor.addEventListener('mouseout', (e) => {
      if (e.target.closest('[data-type]')) App.hideTagTooltip();
    });
  };

  App.handleAtomicDelete = function(e) {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    
    if (e.key === 'Backspace' && range.startOffset === 0) {
      const prev = range.startContainer.previousSibling || range.startContainer.parentNode.previousSibling;
      if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.hasAttribute('data-type')) {
        e.preventDefault();
        prev.remove();
      }
    }
    
    if (e.key === 'Delete') {
      const container = range.startContainer;
      const offset = range.startOffset;
      if (container.nodeType === Node.TEXT_NODE && offset === container.textContent.length) {
        const next = container.nextSibling;
        if (next && next.nodeType === Node.ELEMENT_NODE && next.hasAttribute('data-type')) {
          e.preventDefault();
          next.remove();
        }
      }
    }
  };

  App.handleEditorInput = function(e) {
    const editor = e.currentTarget;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    if (node.nodeType !== Node.TEXT_NODE) {
      App.closeMentionDropdown();
      return;
    }

    const textBeforeCaret = node.textContent.substring(0, range.startOffset);
    const match = textBeforeCaret.match(/@(\w*)$/);

    if (match) {
      App.mentionState.active = true;
      App.mentionState.query = match[1].toLowerCase();
      App.mentionState.node = node;
      App.mentionState.editor = editor;
      App.mentionState.offset = match.index;
      App.mentionState.selectedIndex = 0;
      App.updateMentionDropdown();
      App.positionMentionDropdown(range, editor);
    } else {
      App.closeMentionDropdown();
    }
  };

  App.handleEditorKeydown = function(e) {
    if (!App.mentionState.active) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      App.mentionState.selectedIndex = (App.mentionState.selectedIndex + 1) % App.mentionState.items.length;
      App.renderMentionDropdownItems();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      App.mentionState.selectedIndex = (App.mentionState.selectedIndex - 1 + App.mentionState.items.length) % App.mentionState.items.length;
      App.renderMentionDropdownItems();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (App.mentionState.items.length > 0) {
        e.preventDefault();
        App.insertTagPill(App.mentionState.items[App.mentionState.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      App.closeMentionDropdown();
    }
  };

  App.updateMentionDropdown = function() {
    const pendingTasks = state.tasks.filter(t => t.status !== 'completed').map(t => ({ ...t, _tagType: 'task' }));
    const allPlans = [
      ...(state.horizons.week || []),
      ...(state.horizons.month || []),
      ...(state.horizons.year || [])
    ].filter(h => h.status === 'active').map(h => ({ ...h, _tagType: 'plan' }));

    let combined = [...pendingTasks, ...allPlans];
    
    if (App.mentionState.query) {
      combined = combined.filter(item => {
        const title = item._tagType === 'task' ? item.title : item.content;
        return title.toLowerCase().includes(App.mentionState.query);
      });
    }

    App.mentionState.items = combined.slice(0, 10);

    if (App.mentionState.items.length > 0) {
      App.renderMentionDropdownItems();
      const dd = document.getElementById('mention-dropdown');
      dd.classList.remove('hidden', 'opacity-0', 'scale-95');
    } else {
      App.closeMentionDropdown();
    }
  };

  App.renderMentionDropdownItems = function() {
    const list = document.getElementById('mention-list');
    if (!list) return;

    list.innerHTML = App.mentionState.items.map((item, idx) => {
      const isSelected = idx === App.mentionState.selectedIndex;
      const title = item._tagType === 'task' ? item.title : item.content;
      const icon = item._tagType === 'task' ? '📌 Task' : '🎯 Plan';
      const color = item._tagType === 'task' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      
      return `
        <div data-mention-idx="${idx}" class="mention-item cursor-pointer px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${isSelected ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">${App.escHtml(title)}</span>
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${color}">${icon}</span>
        </div>
      `;
    }).join('');
  };

  App.positionMentionDropdown = function(range, editor) {
    const dd = document.getElementById('mention-dropdown');
    if (!dd) return;
    const rect = range.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = `${rect.bottom + 8}px`;
    dd.style.left = `${rect.left}px`;
  };

  App.closeMentionDropdown = function() {
    App.mentionState.active = false;
    const dd = document.getElementById('mention-dropdown');
    if (dd) dd.classList.add('hidden', 'opacity-0', 'scale-95');
  };

  App.insertTagPill = function(item) {
    if (!App.mentionState.node) return;
    const title = item._tagType === 'task' ? item.title : item.content;
    const isTask = item._tagType === 'task';
    const pillHtml = `<span contenteditable="false" data-type="${item._tagType}" data-id="${item.id}" class="inline-flex items-center gap-1 align-baseline px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none transition-colors ${isTask ? 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100' : 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100'}">@${App.escHtml(title)}</span>`;

    const textBefore = App.mentionState.node.textContent.substring(0, App.mentionState.offset);
    const textAfter = App.mentionState.node.textContent.substring(App.mentionState.offset + 1 + App.mentionState.query.length);

    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(textBefore));
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pillHtml;
    const pillNode = tempDiv.firstChild;
    frag.appendChild(pillNode);
    const spaceNode = document.createTextNode('\u00A0' + textAfter);
    frag.appendChild(spaceNode);

    App.mentionState.node.parentNode.replaceChild(frag, App.mentionState.node);

    if (!spaceNode.nextSibling) {
      const extraSpace = document.createTextNode('\u00A0');
      spaceNode.parentNode.appendChild(extraSpace);
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    sel.addRange(newRange);

    App.closeMentionDropdown();
    App.mentionState.editor?.focus();
  };

  App.submitIdea = async function() {
    const editor = document.getElementById('idea-editor');
    if (!editor) return;
    const content = App.serializeEditor(editor);
    if (!content) return;

    const pills = editor.querySelectorAll('[data-type]');
    let linkedTaskId = null;
    let linkedHorizonId = null;
    pills.forEach(pill => {
      const type = pill.getAttribute('data-type');
      const id = pill.getAttribute('data-id');
      if (type === 'task' && !linkedTaskId) linkedTaskId = parseInt(id);
      if (type === 'plan' && !linkedHorizonId) linkedHorizonId = parseInt(id);
    });

    if (state.editingIdeaId) {
      await App.saveEdit(state.editingIdeaId);
    } else {
      const res = await App.api('add_idea', { content, linked_task_id: linkedTaskId, linked_horizon_id: linkedHorizonId });
      if (res.success) {
        const newIdea = { ...res.idea, _isNew: true };
        state.ideas.unshift(newIdea);
        editor.innerHTML = '';
        const charCount = document.getElementById('idea-char-count');
        if (charCount) charCount.textContent = '0 chars';
        App.renderIdeas();
        App.showIdeaFeedback();
        setTimeout(() => { newIdea._isNew = false; }, 1000);
      }
    }
  };

  App.editIdea = function(id) {
    const idea = state.ideas.find(i => i.id == id);
    if (!idea) return;
    state.editingIdeaId = id;
    const editor = document.getElementById('idea-editor');
    if (editor) {
      editor.innerHTML = App.deserializeIdeaContent(idea.content);
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    App.updateCaptureAreaUI();
    App.renderIdeas();
  };

  App.saveEdit = async function(id) {
    const editor = document.getElementById('idea-editor');
    if (!editor) return;
    const pills = editor.querySelectorAll('[data-type]');
    let linkedTaskId = null;
    let linkedHorizonId = null;
    pills.forEach(pill => {
      const type = pill.getAttribute('data-type');
      const pid = pill.getAttribute('data-id');
      if (type === 'task' && !linkedTaskId) linkedTaskId = parseInt(pid);
      if (type === 'plan' && !linkedHorizonId) linkedHorizonId = parseInt(pid);
    });

    const content = App.serializeEditor(editor);
    if (!content) return;

    const res = await App.api('update_idea', { id, content, linked_task_id: linkedTaskId, linked_horizon_id: linkedHorizonId });
    if (res.success) {
      const idea = state.ideas.find(i => i.id == id);
      if (idea) {
        idea.content = content;
        idea.linked_task_id = linkedTaskId;
        idea.linked_horizon_id = linkedHorizonId;
      }
      state.editingIdeaId = null;
      editor.innerHTML = '';
      App.updateCaptureAreaUI();
      App.renderIdeas();
      App.showIdeaFeedback();
    }
  };

  App.deleteIdea = async function(id) {
    if (!confirm('Are you sure you want to delete this idea?')) return;
    const res = await App.api('delete_idea', { id });
    if (res.success) {
      state.ideas = state.ideas.filter(i => i.id != id);
      App.renderIdeas();
    }
  };

  App.cancelEdit = function() {
    state.editingIdeaId = null;
    const editor = document.getElementById('idea-editor');
    if (editor) editor.innerHTML = '';
    App.updateCaptureAreaUI();
    App.renderIdeas();
  };

  App.serializeEditor = function(editor) {
    if (!editor) return '';
    const pills = editor.querySelectorAll('[data-type]');
    const originalStates = [];
    pills.forEach(pill => {
      const type = pill.getAttribute('data-type');
      const id = pill.getAttribute('data-id');
      originalStates.push({ pill, text: pill.innerText });
      pill.innerText = `@${type}:${id}`;
    });
    let content = editor.innerText.trim();
    originalStates.forEach(item => { item.pill.innerText = item.text; });
    return content.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  App.deserializeIdeaContent = function(text) {
    if (!text) return '';
    return App.escHtml(text)
      .replace(/@task:(\d+)/g, (match, id) => {
        const task = state.tasks.find(t => t.id == id);
        const title = task ? task.title : `Task:${id}`;
        return `<span contenteditable="false" data-type="task" data-id="${id}" class="inline-flex items-center gap-1 align-baseline px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none transition-colors bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100">@${App.escHtml(title)}</span>`;
      })
      .replace(/@plan:(\d+)/g, (match, id) => {
        const content = App.getHorizonContent(id);
        const title = content ? content : `Plan Deleted (${id})`;
        const classes = content ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800" : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-800 line-through opacity-70";
        return `<span contenteditable="false" data-type="plan" data-id="${id}" class="inline-flex items-center gap-1 align-baseline px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none transition-colors hover:opacity-100 ${classes}">@${App.escHtml(title)}</span>`;
      });
  };

})(window.TimeApp);
