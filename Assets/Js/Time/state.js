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
    duration: 25 * 60,
    breakDuration: 5 * 60,
    remaining: 25 * 60,
    isRunning: false,
    isBreak: false,
    interval: null,
    sessions: 0,
  }
};
