'use client';
import { Button, Modal, Input, Select, NumberInput, SectionHeader, Skeleton } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Lightbulb, Plus, Trash2, Edit2, X, Check, Save, Sparkles, Timer, Archive, RotateCcw } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { cn } from '@/lib/utils';
import {
  loadIdeasData, addIdeaRequest, updateIdeaRequest, deleteIdeaRequest, setIdeaDoneRequest,
  quickAddTaskRequest, updateTaskInfoRequest,
  type Task, type Horizon, type Idea,
} from './page.services';

// A live task/plan the mention engine can link to, plus a synthetic "create"
// row shown when the query matches no existing task.
type CreateItem = { _tagType: 'create'; label: string };
type MentionItem =
  | (Task & { _tagType: 'task' })
  | (Horizon & { _tagType: 'plan' })
  | CreateItem;

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'medium', label: 'Medium' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'free', label: 'Free' },
];

export default function IdeaCapturePage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Data State
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [isLoading]);

  // Editor State
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);

  // Mentions Dropdown State
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionList, setMentionList] = useState<MentionItem[]>([]);
  const [mentionIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  // Snapshot of the caret at the moment `@…` is typed, so a pill can still be
  // inserted after an async create round-trip has blurred the live selection.
  const mentionRangeRef = useRef<Range | null>(null);

  // Inline Task Editor (opened by clicking a task pill)
  const [taskEditor, setTaskEditor] = useState<Task | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorPriority, setEditorPriority] = useState('medium');
  const [editorTimer, setEditorTimer] = useState('25');
  const [savingTask, setSavingTask] = useState(false);

  // Expanded Ideas Vault items
  const [expandedIdeaIds, setExpandedIdeaIds] = useState<Record<number, boolean>>({});

  const loadData = async () => {
    try {
      const { ideas, tasks, horizons } = await loadIdeasData();
      setIdeas(ideas);
      setTasks(tasks);
      setHorizons(horizons);
    } catch (err) {
      console.error('Failed to load ideas data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync character count on editor changes
  const updateCharCount = () => {
    if (!editorRef.current) return;
    const text = serializeEditor();
    setCharCount(text.length);
  };

  // Helper: Serialize contenteditable HTML to @task:id / @plan:id markup
  const serializeEditor = (): string => {
    if (!editorRef.current) return '';
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    const pills = clone.querySelectorAll('[data-type]');
    pills.forEach((pill) => {
      const type = pill.getAttribute('data-type');
      const id = pill.getAttribute('data-id');
      pill.textContent = `@${type}:${id}`;
    });
    return clone.innerText.trim().replace(/\n{3,}/g, '\n\n');
  };

  // Helper: Deserialize database markup to contenteditable HTML with pills
  const deserializeContent = (text: string): string => {
    if (!text) return '';
    // Escape HTML entities to prevent XSS
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Replace task tags
    escaped = escaped.replace(/@task:(\d+)/g, (match, id) => {
      const task = tasks.find((t) => t.id === parseInt(id));
      return buildPillHtml('task', parseInt(id), task ? task.title : `Task:${id}`);
    });

    // Replace plan tags
    escaped = escaped.replace(/@plan:(\d+)/g, (match, id) => {
      const plan = horizons.find((h) => h.id === parseInt(id));
      return buildPillHtml('plan', parseInt(id), plan ? plan.content : `Plan:${id}`);
    });

    return escaped;
  };

  // Triggered on keydown inside contenteditable editor
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % mentionList.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + mentionList.length) % mentionList.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (mentionList.length > 0) {
          e.preventDefault();
          handleSelectMention(mentionList[mentionIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionActive(false);
      }
    } else {
      // Allow saving via Ctrl + Enter
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSubmitIdea();
      }
    }
  };

  // On editor inputs, check if cursor is after @
  const handleEditorInput = () => {
    updateCharCount();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      setMentionActive(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setMentionActive(false);
      return;
    }

    const textBeforeCaret = node.textContent?.substring(0, range.startOffset) || '';
    // Allow spaces so multi-word task names ("@buy groceries") can be created,
    // but never after a double-space and cap the length so `@` in ordinary prose
    // doesn't leave the menu hanging open across a whole sentence.
    const match = textBeforeCaret.match(/@([\w]+(?: [\w]+)*)?$/);

    if (match && (match[1]?.length ?? 0) <= 40) {
      const rawQuery = (match[1] || '').trim();
      const queryStr = rawQuery.toLowerCase();
      setMentionActive(true);
      setSelectedIndex(0);
      // Freeze the caret position now — a click on a create row will blur the
      // editor before the async task insert completes.
      mentionRangeRef.current = range.cloneRange();

      // Filter tasks and plans
      const pendingTasks = tasks.filter((t) => t.status === 'pending').map((t) => ({ ...t, _tagType: 'task' as const }));
      const activePlans = horizons.filter((h) => h.status === 'active').map((h) => ({ ...h, _tagType: 'plan' as const }));
      let combined: MentionItem[] = [...pendingTasks, ...activePlans];

      if (queryStr) {
        combined = combined.filter((item) => {
          const title = item._tagType === 'task' ? item.title : (item as Horizon).content;
          return title.toLowerCase().includes(queryStr);
        });
      }

      combined = combined.slice(0, 7);

      // Offer to spin up a brand-new task when the query names something that
      // doesn't exist yet (no exact title match among pending tasks).
      const exactExists = tasks.some((t) => t.title.toLowerCase() === queryStr);
      if (rawQuery && !exactExists) {
        combined.push({ _tagType: 'create', label: rawQuery });
      }

      setMentionList(combined);

      // Position dropdown
      const rect = range.getBoundingClientRect();
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom - containerRect.top + 8,
          left: rect.left - containerRect.left,
        });
      } else {
        setDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
        });
      }
    } else {
      setMentionActive(false);
    }
  };

  // Pill markup for a linked task/plan (shared by insert + deserialize).
  const buildPillHtml = (type: 'task' | 'plan', id: number, label: string): string => {
    const styles = type === 'task'
      ? 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100'
      : 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100';
    const editable = type === 'task' ? ' cursor-pointer' : ' cursor-default';
    return `<span contenteditable="false" data-type="${type}" data-id="${id}" class="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border select-none${editable} ${styles}">@${label}</span>`;
  };

  // Insert a resolved task/plan pill at the frozen `@…` caret snapshot, replacing
  // the `@query` text. Uses mentionRangeRef so it survives an async create.
  const performInsert = (type: 'task' | 'plan', id: number, label: string) => {
    const range = mentionRangeRef.current;
    if (!range || !editorRef.current) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const caretOffset = range.startOffset;
    const atOffset = text.substring(0, caretOffset).lastIndexOf('@');
    if (atOffset === -1) return;

    const textBefore = text.substring(0, atOffset);
    const textAfter = text.substring(caretOffset);

    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(textBefore));

    const temp = document.createElement('div');
    temp.innerHTML = buildPillHtml(type, id, label);
    frag.appendChild(temp.firstChild!);

    // Trailing non-breaking space so the user can keep typing after the pill.
    const spaceNode = document.createTextNode('\u00A0' + textAfter);
    frag.appendChild(spaceNode);

    node.parentNode!.replaceChild(frag, node);

    // Move cursor after the inserted space.
    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    mentionRangeRef.current = null;
    setMentionActive(false);
    editorRef.current.focus();
    updateCharCount();
  };

  // Dropdown selection — resolves a live task/plan, or quick-creates a task
  // from an unmatched query, then drops the pill in.
  const handleSelectMention = async (item: MentionItem) => {
    if (item._tagType === 'create') {
      const newTask = await quickAddTaskRequest(item.label);
      if (!newTask) return;
      setTasks((prev) => [...prev, newTask]);
      performInsert('task', newTask.id, newTask.title);
      return;
    }
    if (item._tagType === 'task') {
      performInsert('task', item.id, item.title);
    } else {
      performInsert('plan', item.id, item.content);
    }
  };

  // Click a task pill inside the editor → open the inline task editor.
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pill = (e.target as HTMLElement).closest('[data-type="task"]');
    if (!pill) return;
    const id = parseInt(pill.getAttribute('data-id') || '0');
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setTaskEditor(task);
    setEditorTitle(task.title);
    setEditorPriority(task.priority || 'medium');
    setEditorTimer(String(task.duration_block || 25));
  };

  // Save the inline task editor: persist, refresh linked state, and relabel any
  // live pills pointing at this task so the editor stays truthful.
  const handleSaveTaskInfo = async () => {
    if (!taskEditor) return;
    const title = editorTitle.trim();
    if (!title) return;
    setSavingTask(true);
    try {
      const updated = await updateTaskInfoRequest(taskEditor.id, {
        title,
        priority: editorPriority,
        duration_block: Math.max(5, parseInt(editorTimer) || 25),
        horizonId: taskEditor.horizon_id ?? null,
      });
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
        if (editorRef.current) {
          editorRef.current
            .querySelectorAll(`[data-type="task"][data-id="${updated.id}"]`)
            .forEach((pill) => { pill.textContent = `@${updated.title}`; });
          updateCharCount();
        }
        setTaskEditor(null);
      }
    } catch (err) {
      console.error('Error saving task info:', err);
    } finally {
      setSavingTask(false);
    }
  };

  // Submit / Capture Idea
  const handleSubmitIdea = async () => {
    if (!editorRef.current) return;
    const content = serializeEditor();
    if (!content) return;

    // Extract first linked task/horizon from DOM pills
    const pills = editorRef.current.querySelectorAll('[data-type]');
    let linkedTaskId: number | null = null;
    let linkedHorizonId: number | null = null;

    pills.forEach((pill) => {
      const type = pill.getAttribute('data-type');
      const id = parseInt(pill.getAttribute('data-id') || '0');
      if (type === 'task' && !linkedTaskId) linkedTaskId = id;
      if (type === 'plan' && !linkedHorizonId) linkedHorizonId = id;
    });

    try {
      if (editingIdeaId) {
        // Edit Save
        const ok = await updateIdeaRequest(editingIdeaId, { content, linkedTaskId, linkedHorizonId });
        if (ok) {
          setIdeas(prev => prev.map(i => i.id === editingIdeaId ? { ...i, content, linked_task_id: linkedTaskId, linked_horizon_id: linkedHorizonId } : i));
          setEditingIdeaId(null);
          editorRef.current!.innerHTML = '';
          setCharCount(0);
        }
      } else {
        // Create new
        const idea = await addIdeaRequest({ content, linkedTaskId, linkedHorizonId });
        if (idea) {
          setIdeas(prev => [idea, ...prev]);
          editorRef.current!.innerHTML = '';
          setCharCount(0);
        }
      }
    } catch (err) {
      console.error('Error saving idea:', err);
    }
  };

  // Edit Idea
  const handleEditIdea = (idea: Idea) => {
    setEditingIdeaId(idea.id);
    if (editorRef.current) {
      editorRef.current.innerHTML = deserializeContent(idea.content);
      editorRef.current.focus();
      
      // Move cursor to end
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    updateCharCount();
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingIdeaId(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setCharCount(0);
  };

  // Delete Idea
  const handleDeleteIdea = async (id: number) => {
    if (!confirm('Are you sure you want to delete this idea?')) return;
    try {
      const ok = await deleteIdeaRequest(id);
      if (ok) setIdeas(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error('Error deleting idea:', err);
    }
  };

  // Toggle an idea done/open. Optimistic — flip locally for instant feedback,
  // roll back if the write fails. Vault-only status; no linked task is touched.
  const handleToggleIdeaDone = async (idea: Idea) => {
    const nextDone = idea.status !== 'done';
    setIdeas(prev => prev.map(i => (i.id === idea.id ? { ...i, status: nextDone ? 'done' : 'open' } : i)));
    const ok = await setIdeaDoneRequest(idea.id, nextDone);
    if (!ok) {
      setIdeas(prev => prev.map(i => (i.id === idea.id ? { ...i, status: idea.status } : i)));
    }
  };

  // Expand / Truncate Toggle
  const toggleExpand = (id: number) => {
    setExpandedIdeaIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Render processed text for Vault cards
  const renderFormattedBody = (text: string, isDone = false) => {
    if (!text) return '';

    // Replace markdown and mentions with styled HTML strings in safe client-side render
    let parsed = text;
    parsed = parsed.replace(/@task:(\d+)/g, (match, id) => {
      const task = tasks.find(t => t.id === parseInt(id));
      return `<span class="text-primary-500 font-bold">@${task ? task.title : 'Task'}</span>`;
    });
    parsed = parsed.replace(/@plan:(\d+)/g, (match, id) => {
      const plan = horizons.find(h => h.id === parseInt(id));
      return `<span class="text-purple-500 font-bold">@${plan ? plan.content : 'Plan'}</span>`;
    });

    return (
      <p
        className={cn(
          'text-sm leading-relaxed whitespace-pre-wrap',
          isDone ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-300'
        )}
        dangerouslySetInnerHTML={{ __html: parsed }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto grid grid-cols-1 @3xl:grid-cols-5 gap-8" aria-busy="true">
        <Skeleton className="@3xl:col-span-3 h-80 w-full" />
        <Skeleton className="@3xl:col-span-2 h-80 w-full" />
      </div>
    );
  }

  const resolvedCount = ideas.filter((i) => i.status === 'done').length;

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        (pageRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className="max-w-6xl mx-auto space-y-8 relative"
    >
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FLOATING MENTIONS DROPDOWN MENU
          Rendered absolute using page-relative coordinates for '@' queries
          ────────────────────────────────────────────────────────── */}
      {mentionActive && mentionList.length > 0 && (
        <div 
          className="absolute z-50 w-64 max-h-64 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-glass p-2 scale-100 opacity-100 transition-all"
          style={{
            position: 'absolute',
            top: `${dropdownPos.top - 20}px`,
            left: `${dropdownPos.left}px`
          }}
        >
          <div className="px-3 pb-2 mb-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
            Link to…
          </div>
          <div className="space-y-0.5">
            {mentionList.map((item, idx) => {
              const isSelected = idx === mentionIndex;

              // Synthetic "create new task" row.
              if (item._tagType === 'create') {
                return (
                  <Button variant="unstyled"
                    key="create-new-task"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectMention(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                      isSelected ? 'bg-primary-500/15 text-primary-400' : 'text-slate-400 hover:bg-slate-850/50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary-500" />
                    <span className="truncate">
                      Create task <span className="text-primary-400">"{item.label}"</span>
                    </span>
                  </Button>
                );
              }

              const isTask = item._tagType === 'task';
              const title = isTask ? item.title : (item as Horizon).content;
              return (
                <Button variant="unstyled"
                  key={`${item._tagType}-${item.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectMention(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-850/50'
                  }`}
                >
                  <span className="truncate max-w-[150px]">{title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isTask
                      ? 'bg-primary-500/15 text-primary-500'
                      : 'bg-purple-500/15 text-purple-500'
                  }`}>
                    {isTask ? 'Task' : 'Plan'}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: INLINE TASK EDITOR MODAL
          Opened by clicking a task pill — sets title, priority, and the
          focus timer (duration_block) that drives the Pomodoro page
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!taskEditor}
        onClose={() => setTaskEditor(null)}
        title="Edit task"
        description="Set the details and the focus timer for this linked task."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskEditor(null)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveTaskInfo}
              disabled={savingTask || !editorTitle.trim()}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingTask ? 'Saving…' : 'Save task'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label="Task title"
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            placeholder="What needs doing?"
            leftIcon={<Check className="w-4 h-4" />}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTaskInfo(); }}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={editorPriority}
              onChange={(v) => setEditorPriority(String(v))}
              options={PRIORITY_OPTIONS}
            />

            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-2 block">
                Focus timer
              </label>
              <NumberInput
                value={editorTimer}
                onChange={setEditorTimer}
                min={5}
                max={120}
                step={5}
                prefix={<Timer className="w-4 h-4" />}
                ariaLabel="Focus timer in minutes"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">Minutes per focus block</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER SECTION
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Idea capture</h1>
            <p className="text-xs text-slate-400">Write freely now, tag it to work later.</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 surface-card border border-slate-800/60 px-4 py-2.5 rounded-2xl shadow-apple-sm self-start">
          Link items: <code className="text-primary-500 font-bold bg-primary-500/5 px-1.5 py-0.5 rounded ml-1">@task</code> or <code className="text-purple-500 font-bold bg-purple-500/5 px-1.5 py-0.5 rounded">@plan</code>
        </div>
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-5 gap-8">

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: CONTENTEDITABLE EDITOR WRAPPER
            Supports rich pills, key listeners for Arrow/Enter/Esc dropdown control
            ────────────────────────────────────────────────────────── */}
        <div className="@3xl:col-span-3 space-y-6">
          <div data-entrance="card" className="surface-raised border border-slate-800/60 rounded-3xl p-6">

            {/* Editor Textarea */}
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                onKeyDown={handleEditorKeyDown}
                onInput={handleEditorInput}
                onClick={handleEditorClick}
                className="w-full min-h-[220px] bg-transparent text-sm text-slate-200 focus:outline-none leading-relaxed whitespace-pre-wrap outline-none"
                data-placeholder="Start writing your idea... Type @ to link a task or dream goal. Press Ctrl+Enter to save instantly."
              />
              
              {/* Custom CSS placeholder inside contenteditable */}
              <style jsx>{`
                div[contenteditable]:empty:before {
                  content: attr(data-placeholder);
                  color: #94a3b8;
                  pointer-events: none;
                  white-space: pre-wrap;
                }
                :global(.dark) div[contenteditable]:empty:before {
                  color: #475569;
                }
              `}</style>
            </div>

            {/* Footer Row */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-850">
              <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold">
                <span>Ctrl + Enter to save</span>
                <span className="font-mono">{charCount} chars</span>
              </div>

              <div className="flex items-center gap-2">
                {editingIdeaId && (
                  <Button variant="unstyled"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleSubmitIdea}
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={editingIdeaId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                >
                  {editingIdeaId ? 'Update idea' : 'Capture idea'}
                </Button>
              </div>
            </div>

          </div>

          {/* Guide Help Card */}
          <div className="surface-base rounded-2xl p-5 border border-slate-800/60">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">
              How linking works
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When typing your idea, type <code className="text-emerald-500 font-bold bg-emerald-500/5 px-1 rounded">@</code> to open the reference engine. Link an existing task or dream horizon — or, if none matches, hit <span className="text-primary-400 font-semibold">Create task</span> to spin up a new one on the spot. Click any <span className="text-primary-400 font-semibold">task pill</span> to set its priority and focus timer.
            </p>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: IDEA VAULT CARDS GRID
            Renders filtered ideas list with edit/delete control and formatting
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="@3xl:col-span-2 surface-base border border-slate-800/60 rounded-3xl p-6 flex flex-col min-h-[460px]">
          <div className="mb-5 pb-3 border-b border-slate-850">
            <SectionHeader
              icon={<Archive />}
              accent="primary"
              title="Idea vault"
              count={ideas.length}
              countLabel={ideas.length === 1 ? 'idea' : 'ideas'}
              actions={
                resolvedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/70 border border-slate-700/60 px-2 py-1 rounded-lg">
                    <Check className="w-3 h-3" />
                    {resolvedCount} resolved
                  </span>
                ) : undefined
              }
            />
          </div>

          {/* List */}
          <div className="flex-grow overflow-y-auto space-y-4 max-h-[480px] pr-1">
            {ideas.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">Your vault is empty.</p>
                <p className="text-xs text-slate-500 mt-1">Start writing to capture your first idea.</p>
              </div>
            ) : (
              ideas.map((idea) => {
                const isExpanded = !!expandedIdeaIds[idea.id];
                const contentText = idea.content || '';
                const displayLimit = 150;
                
                // Truncation check
                const isTruncated = contentText.length > displayLimit;
                const visibleText = isTruncated && !isExpanded 
                  ? contentText.substring(0, displayLimit) + '…'
                  : contentText;

                const isDone = idea.status === 'done';
                // Left-edge accent mirrors what the idea links to while it's open —
                // @task → primary (orange), @plan → purple — matching the coloured
                // chip in the body. A done idea drops to a dead muted grey (paired
                // with the dim + strikethrough) so it reads as finished, not active.
                const accentColor = isDone
                  ? 'bg-slate-700'
                  : idea.linked_task_id
                    ? 'bg-primary-500'
                    : idea.linked_horizon_id
                      ? 'bg-purple-500'
                      : 'bg-slate-500';
                return (
                  <div
                    key={idea.id}
                    className={cn(
                      'group relative pl-5 pr-4 py-3.5 surface-sunken border border-slate-850/50 rounded-xl transition-all hover:border-slate-800',
                      isDone && 'opacity-70'
                    )}
                  >
                    {/* Left-edge accent = link colour when open, dead grey when done. */}
                    <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full edge-accent', accentColor)} />

                    {/* Body */}
                    {renderFormattedBody(visibleText, isDone)}

                    {isTruncated && (
                      <Button variant="unstyled"
                        onClick={() => toggleExpand(idea.id)}
                        className="mt-2 text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors underline underline-offset-2"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </Button>
                    )}

                    {/* Metadata Footer — date on the left, actions on the right.
                        Actions live in this row (not an absolute overlay) so they
                        never cover the body text. Hover/focus reveals them only on
                        hover-capable pointers; touch devices (hover: none) always
                        see them — group-hover never fires on tap. */}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-850/30">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {new Date(idea.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>

                      <div className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button variant="unstyled"
                          onClick={() => handleToggleIdeaDone(idea)}
                          title={isDone ? 'Reopen idea' : 'Mark idea done'}
                          className={cn(
                            'p-1.5 rounded-lg shadow-sm border border-transparent hover:bg-slate-800 hover:border-slate-750 transition-all',
                            isDone ? 'text-slate-400 hover:text-amber-500' : 'text-slate-400 hover:text-emerald-500'
                          )}
                        >
                          {/* Check (mark done) ⇄ RotateCcw (undo) crossfade — the icon
                              itself flips so the button reads as reversible once done. */}
                          <span className="relative block w-3.5 h-3.5">
                            <Check className={cn(
                              'absolute inset-0 w-3.5 h-3.5 stroke-[3] transition-all duration-200 motion-reduce:transition-none',
                              isDone ? 'opacity-0 scale-50 -rotate-90' : 'opacity-100 scale-100 rotate-0'
                            )} />
                            <RotateCcw className={cn(
                              'absolute inset-0 w-3.5 h-3.5 stroke-[3] transition-all duration-200 motion-reduce:transition-none',
                              isDone ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'
                            )} />
                          </span>
                        </Button>
                        <Button variant="unstyled"
                          onClick={() => handleEditIdea(idea)}
                          title="Edit idea"
                          className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-slate-750 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="unstyled"
                          onClick={() => handleDeleteIdea(idea.id)}
                          title="Delete idea"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-slate-750 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
