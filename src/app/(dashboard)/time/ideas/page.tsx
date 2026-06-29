'use client';
import { Button } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Lightbulb, Plus, Trash2, Edit2, X, Check, Save } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import {
  loadIdeasData, addIdeaRequest, updateIdeaRequest, deleteIdeaRequest,
  type Task, type Horizon, type Idea,
} from './page.services';

type MentionItem = (Task & { _tagType: 'task' }) | (Horizon & { _tagType: 'plan' });

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
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionList, setMentionList] = useState<MentionItem[]>([]);
  const [mentionIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

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
      const title = task ? task.title : `Task:${id}`;
      return `<span contenteditable="false" data-type="task" data-id="${id}" class="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100">@${title}</span>`;
    });

    // Replace plan tags
    escaped = escaped.replace(/@plan:(\d+)/g, (match, id) => {
      const plan = horizons.find((h) => h.id === parseInt(id));
      const title = plan ? plan.content : `Plan:${id}`;
      return `<span contenteditable="false" data-type="plan" data-id="${id}" class="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100">@${title}</span>`;
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
          insertTagPill(mentionList[mentionIndex]);
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
    const match = textBeforeCaret.match(/@(\w*)$/);

    if (match) {
      const queryStr = match[1].toLowerCase();
      setMentionActive(true);
      setMentionQuery(queryStr);
      setSelectedIndex(0);

      // Filter tasks and plans
      const pendingTasks = tasks.filter((t) => t.status === 'pending').map((t) => ({ ...t, _tagType: 'task' as const }));
      const activePlans = horizons.filter((h) => h.status === 'active').map((h) => ({ ...h, _tagType: 'plan' as const }));
      let combined = [...pendingTasks, ...activePlans];

      if (queryStr) {
        combined = combined.filter((item) => {
          const title = item._tagType === 'task' ? item.title : item.content;
          return title.toLowerCase().includes(queryStr);
        });
      }

      setMentionList(combined.slice(0, 8));

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

  // Insert tag pill at caret position
  const insertTagPill = (item: MentionItem) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const queryLength = mentionQuery.length;
    // Find where the '@' is
    const offset = text.substring(0, range.startOffset).lastIndexOf('@');
    if (offset === -1) return;

    const textBefore = text.substring(0, offset);
    const textAfter = text.substring(offset + 1 + queryLength);

    const isTask = item._tagType === 'task';
    const label = isTask ? item.title : item.content;
    const pillHtml = `<span contenteditable="false" data-type="${item._tagType}" data-id="${item.id}" class="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none ${
      isTask 
        ? 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100' 
        : 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100'
    }">@${label}</span>`;

    // Replace the text node content
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(textBefore));

    const temp = document.createElement('div');
    temp.innerHTML = pillHtml;
    const pillNode = temp.firstChild!;
    frag.appendChild(pillNode);

    // Add a trailing non-breaking space so user can type after the pill
    const spaceNode = document.createTextNode('\u00A0' + textAfter);
    frag.appendChild(spaceNode);

    const parent = node.parentNode!;
    parent.replaceChild(frag, node);

    // Move cursor after the space
    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    setMentionActive(false);
    editorRef.current.focus();
    updateCharCount();
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

  // Expand / Truncate Toggle
  const toggleExpand = (id: number) => {
    setExpandedIdeaIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Render processed text for Vault cards
  const renderFormattedBody = (text: string) => {
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
        className="text-sm text-slate-300 leading-relaxed pr-6 whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: parsed }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
          <div className="px-3 pb-2 mb-2 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Link to...
          </div>
          <div className="space-y-0.5">
            {mentionList.map((item, idx) => {
              const isSelected = idx === mentionIndex;
              const isTask = item._tagType === 'task';
              const title = isTask ? item.title : item.content;
              return (
                <Button variant="unstyled"
                  key={`${item._tagType}-${item.id}`}
                  onClick={() => insertTagPill(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors${
                    isSelected 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:bg-slate-850/50'
                  }`}
                >
                  <span className="truncate max-w-[150px]">{title}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full${
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
          DEVELOPMENT NAVIGATOR: PAGE HEADER SECTION
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Idea Capture</h1>
            <p className="text-xs text-slate-400">Your brain dump zone — write freely, tag later.</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-[#1A1D24] border border-slate-800/60 px-4 py-2.5 rounded-2xl shadow-apple-sm self-start">
          Link items: <code className="text-emerald-500 font-bold bg-emerald-500/5 px-1.5 py-0.5 rounded ml-1">@task</code> or <code className="text-purple-500 font-bold bg-purple-500/5 px-1.5 py-0.5 rounded">@plan</code>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: CONTENTEDITABLE EDITOR WRAPPER
            Supports rich pills, key listeners for Arrow/Enter/Esc dropdown control
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">

            {/* Editor Textarea */}
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                onKeyDown={handleEditorKeyDown}
                onInput={handleEditorInput}
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
                    className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </Button>
                )}
                <Button variant="unstyled"
                  onClick={handleSubmitIdea}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/10 active:scale-[0.98] flex items-center gap-2"
                >
                  {editingIdeaId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                  {editingIdeaId ? 'Update Idea' : 'Capture Idea'}
                </Button>
              </div>
            </div>

          </div>

          {/* Guide Help Card */}
          <div className="bg-emerald-950/10 rounded-2xl p-5 border border-emerald-900/20">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              Mentions Engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When typing your idea, type <code className="text-emerald-500 font-bold bg-emerald-500/5 px-1 rounded">@</code> to open the reference engine. You can search and link task entries or dream horizons, turning a simple brain dump into an actionable network of thoughts.
            </p>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: IDEA VAULT CARDS GRID
            Renders filtered ideas list with edit/delete control and formatting
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="lg:col-span-2 bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-850">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
              Idea Vault
            </h2>
            <span className="text-xs text-slate-400 font-bold bg-slate-900/60 px-2.5 py-1 rounded-full">
              {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}
            </span>
          </div>

          {/* List */}
          <div className="flex-grow overflow-y-auto space-y-4 max-h-[480px] pr-1">
            {ideas.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">Your Vault is empty.</p>
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
                  ? contentText.substring(0, displayLimit) + '...'
                  : contentText;

                return (
                  <div
                    key={idea.id}
                    className="p-4 bg-slate-900/30 border border-slate-850/50 rounded-2xl transition-all hover:border-slate-800 group relative hover:shadow-apple-sm"
                  >
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="unstyled"
                        onClick={() => handleEditIdea(idea)}
                        title="Edit Idea"
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-slate-750 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="unstyled"
                        onClick={() => handleDeleteIdea(idea.id)}
                        title="Delete Idea"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-slate-750 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Body */}
                    {renderFormattedBody(visibleText)}

                    {isTruncated && (
                      <Button variant="unstyled"
                        onClick={() => toggleExpand(idea.id)}
                        className="mt-2 text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors underline underline-offset-2"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </Button>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-850/30">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {new Date(idea.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
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
