/**
 * Time Application - Tasks Module
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  const { state } = App;

  App.addTask = async function(data) {
    const res = await App.api('add_task', data);
    if (res.success) {
      state.tasks.push(res.task);
      App.renderTaskList();
      App.renderTaskStack();
    }
  };

  App.markTaskComplete = async function(id, actualDuration = null) {
    const task = state.tasks.find(t => t.id == id);
    if (task) {
      task.status = 'completed';
      task.actual_duration = actualDuration;
    }
    App.renderTaskList();
    App.renderTaskStack();
    await App.api('complete_task', { id, actual_duration: actualDuration });
  };

  App.deleteTask = async function(id) {
    const task = state.tasks.find(t => t.id == id);
    if (task) {
      state.undoBuffer = { ...task };
      App.showUndoToast('Task deleted', async () => {
        const res = await App.api('restore_task', { id: state.undoBuffer.id });
        if (res.success) {
          state.tasks.push({ ...state.undoBuffer });
          App.renderTaskList();
          App.renderTaskStack();
        }
      });
    }

    await App.api('delete_task', { id });
    state.tasks = state.tasks.filter(t => t.id != id);
    if (state.currentTaskIndex >= state.tasks.filter(t => t.status !== 'completed').length) {
      state.currentTaskIndex = Math.max(0, state.currentTaskIndex - 1);
    }
    App.renderTaskList();
    App.renderTaskStack();
  };

  App.openEditTask = function(id) {
    const task = state.tasks.find(t => t.id == id);
    if (!task) return;

    state.editingTaskId = id;
    const modal = document.getElementById('modal-edit-task');
    if (modal) {
      document.getElementById('edit-task-title').value = task.title;
      document.getElementById('edit-task-priority').value = task.priority;
      document.getElementById('edit-task-duration').value = task.duration_block;
      document.getElementById('edit-task-horizon').value = task.horizon_id || '';
      
      const pSelected = document.getElementById('edit-priority-selected');
      if (pSelected) {
        const colors = { urgent: 'bg-red-400', medium: 'bg-amber-400', maybe: 'bg-blue-400', free: 'bg-slate-300' };
        const label = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
        pSelected.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${colors[task.priority]}"></span><span>${label}</span>`;
      }

      window.openModal('modal-edit-task');
    }
  };

  App.updateTask = async function(data) {
    const taskIdx = state.tasks.findIndex(t => t.id == state.editingTaskId);
    if (taskIdx === -1) return;

    const prevState = { ...state.tasks[taskIdx] };

    const res = await App.api('update_task', { id: state.editingTaskId, ...data });
    if (res.success) {
      state.tasks[taskIdx] = res.task;
      
      App.showUndoToast('Task updated', async () => {
        const revertRes = await App.api('update_task', { id: prevState.id, ...prevState });
        if (revertRes.success) {
          const currentIdx = state.tasks.findIndex(t => t.id == prevState.id);
          if (currentIdx !== -1) state.tasks[currentIdx] = revertRes.task;
          App.renderTaskList();
          App.renderTaskStack();
        }
      });

      window.closeModal('modal-edit-task');
      App.renderTaskList();
      App.renderTaskStack();
    }
  };

  App.restoreTask = async function(id) {
    const task = state.tasks.find(t => t.id == id);
    if (task) task.status = 'pending';
    App.renderTaskList();
    App.renderTaskStack();
    await App.api('restore_task', { id });
  };

})(window.TimeApp);
