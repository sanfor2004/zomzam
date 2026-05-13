/**
 * Time Application - Utilities
 */
window.TimeApp = window.TimeApp || {};

(function(App) {

  App.escHtml = function(text) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(text || ''));
    return d.innerHTML;
  };

  App.priorityColor = function(p) {
    return {
      urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      maybe: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      free: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    }[p] || 'bg-slate-100 text-slate-500';
  };

  App.formatDuration = function(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  App.timeAgo = function(dateStr) {
    if (!dateStr) return 'just now';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  App.shakeField = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('ring-2', 'ring-red-400');
    el.focus();
    setTimeout(() => el.classList.remove('ring-2', 'ring-red-400'), 1500);
  };

})(window.TimeApp);
