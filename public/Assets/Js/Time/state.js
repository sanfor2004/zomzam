/**
 * Time Application - State Management
 */
window.TimeApp = window.TimeApp || {};

window.TimeApp.state = {
  tasks: [],
  horizons: { week: [], month: [], year: [] },
  ideas: [],
  editingIdeaId: null,
  editingTaskId: null,
  currentTaskIndex: 0,
  lastCurrentTaskId: null,
  undoBuffer: null,
  pomodoro: {
    duration: 15 * 60,
    breakDuration: 5 * 60,
    remaining: 15 * 60,
    isRunning: false,
    isBreak: false,
    interval: null,
    sessions: 0,
    currentTaskStartTime: null,
    segments: [], // [{type: 'work'|'break', duration: seconds}]
    currentSegmentIndex: 0,
    lastCompletionStats: null
  }
};
