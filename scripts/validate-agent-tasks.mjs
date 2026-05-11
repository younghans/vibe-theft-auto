import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  appendAgentTaskLog,
  approveAgentTaskDeploy,
  cancelAgentTask,
  claimNextAgentTask,
  createAgentTask,
  getAgentTask,
  listAgentTasks,
  updateAgentTask
} from '../server/src/agentTasks.js';

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'stickrpg-agent-tasks-'));
const filePath = path.join(tempRoot, 'agent-tasks.json');

try {
  const created = await createAgentTask({
    scope: 'school_minigame',
    gameId: 'teacher-is-looking',
    prompt: 'Make the teacher turn animation smoother.',
    mode: 'preview',
    snapshot: {
      phase: 'playing',
      remainingMs: 4200
    }
  }, {
    createdBy: 'validator',
    filePath
  });

  assert.match(created.id, /^task_/u);
  assert.equal(created.status, 'queued');
  assert.equal(created.scope, 'school_minigame');

  const listed = await listAgentTasks({ scope: 'school_minigame', filePath });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.id);

  const claim = await claimNextAgentTask({
    workerId: 'validator-worker',
    scope: 'school_minigame',
    filePath
  });
  assert.equal(claim.action, 'code_change');
  assert.equal(claim.task.id, created.id);
  assert.equal(claim.task.status, 'claimed');
  assert.equal(claim.task.claimedBy, 'validator-worker');

  const preparing = await updateAgentTask(created.id, {
    status: 'preparing',
    branch: 'agent/task-validator'
  }, { filePath });
  assert.equal(preparing.status, 'preparing');
  assert.equal(preparing.branch, 'agent/task-validator');

  const logged = await appendAgentTaskLog(created.id, {
    level: 'info',
    message: 'Validation log entry.'
  }, { filePath });
  assert.ok(logged.logs.some((entry) => entry.message === 'Validation log entry.'));

  const ready = await updateAgentTask(created.id, {
    status: 'ready_for_review',
    commitSha: 'abc1234'
  }, { filePath });
  assert.equal(ready.status, 'ready_for_review');

  const approved = await approveAgentTaskDeploy(created.id, {
    approvedBy: 'validator',
    filePath
  });
  assert.ok(approved.deployApprovedAt > 0);

  const deployClaim = await claimNextAgentTask({
    workerId: 'deploy-worker',
    scope: 'school_minigame',
    filePath
  });
  assert.equal(deployClaim.action, 'deploy');
  assert.equal(deployClaim.task.status, 'deploying');
  assert.equal(deployClaim.task.claimedBy, 'deploy-worker');

  const second = await createAgentTask({
    scope: 'school_minigame',
    gameId: 'pop-quiz-panic',
    prompt: 'Add a harder question to pop quiz.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  const cancelled = await cancelAgentTask(second.id, {
    cancelledBy: 'validator',
    filePath
  });
  assert.equal(cancelled.status, 'cancelled');

  const fetched = await getAgentTask(created.id, { filePath });
  assert.equal(fetched.id, created.id);
  console.log('Agent task lifecycle validation passed.');
} finally {
  await fsp.rm(tempRoot, { recursive: true, force: true });
}
