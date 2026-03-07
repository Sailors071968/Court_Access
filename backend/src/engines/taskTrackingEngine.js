// ============================================
// Court Access — Task Tracking Engine
// Phase 135: Track investigative task progress
// with status transitions and audit trail
// ============================================

import prisma from '../services/prismaClient.js';

const VALID_TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'pending', 'cancelled'],
  in_progress: ['completed', 'blocked', 'assigned'],
  blocked: ['in_progress', 'cancelled'],
  completed: ['verified'],
  verified: [],
  cancelled: [],
};

/**
 * Transition a task to a new status with audit trail.
 * @param {string} taskId
 * @param {string} newStatus
 * @param {string} actor - Who performed the action
 * @param {string} [notes] - Optional notes
 * @returns {object} Updated task
 */
export async function transitionTask(taskId, newStatus, actor, notes = '') {
  const task = await prisma.investigativeTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task ${taskId} not found`);

  const validNext = VALID_TRANSITIONS[task.status] || [];
  if (!validNext.includes(newStatus)) {
    throw new Error(`Invalid transition: ${task.status} → ${newStatus}. Valid: ${validNext.join(', ')}`);
  }

  const auditEntry = {
    from: task.status,
    to: newStatus,
    actor,
    notes,
    timestamp: new Date().toISOString(),
  };

  const existingHistory = Array.isArray(task.metadata?.statusHistory) ? task.metadata.statusHistory : [];

  const updated = await prisma.investigativeTask.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      assignedTo: newStatus === 'assigned' ? actor : task.assignedTo,
      metadata: {
        ...task.metadata,
        statusHistory: [...existingHistory, auditEntry],
        lastTransition: auditEntry,
      },
    },
  });

  console.log(`[TaskTracking] Task ${taskId}: ${task.status} → ${newStatus} by ${actor}`);
  return updated;
}

/**
 * Get task progress summary for a case.
 * @param {string} caseId
 * @returns {object} Progress summary
 */
export async function getTaskProgress(caseId) {
  const tasks = await prisma.investigativeTask.findMany({ where: { caseId } });

  const total = tasks.length;
  const byStatus = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  }

  const completed = (byStatus.completed || 0) + (byStatus.verified || 0);
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const completedHours = tasks
    .filter(t => t.status === 'completed' || t.status === 'verified')
    .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

  return {
    total,
    byStatus,
    completionRate,
    totalEstimatedHours: totalEstimated,
    completedHours,
    remainingHours: totalEstimated - completedHours,
    blocked: tasks.filter(t => t.status === 'blocked').map(t => ({ id: t.id, title: t.title })),
    overdue: tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'verified' || t.status === 'cancelled') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
  };
}

/**
 * Assign a task to a team member.
 * @param {string} taskId
 * @param {string} assignee
 * @param {string} actor
 * @returns {object} Updated task
 */
export async function assignTask(taskId, assignee, actor) {
  return transitionTask(taskId, 'assigned', actor, `Assigned to ${assignee}`);
}

export async function getTaskHistory(taskId) {
  const task = await prisma.investigativeTask.findUnique({ where: { id: taskId } });
  if (!task) return [];
  return task.metadata?.statusHistory || [];
}
