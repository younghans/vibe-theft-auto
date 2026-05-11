import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  appendAgentTaskLog,
  approveAgentTaskDeploy,
  approveAgentTaskRollback,
  cancelAgentTask,
  claimNextAgentTask,
  createAgentTask,
  getAgentTask,
  listAgentTasks,
  updateAgentTask
} from '../server/src/agentTasks.js';
import {
  getAgentDeploymentState,
  recordAgentDeploymentState
} from '../server/src/agentDeployments.js';

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'stickrpg-agent-tasks-'));
const filePath = path.join(tempRoot, 'agent-tasks.json');
const deploymentFilePath = path.join(tempRoot, 'agent-deployments.json');

try {
  const created = await createAgentTask({
    scope: 'game',
    contextType: 'school_minigame',
    contextLabel: 'School: Teacher Is Looking',
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
  assert.equal(created.scope, 'game');
  assert.equal(created.contextType, 'school_minigame');
  assert.equal(created.contextLabel, 'School: Teacher Is Looking');

  const listed = await listAgentTasks({ scope: 'game', filePath });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.id);

  const claim = await claimNextAgentTask({
    workerId: 'validator-worker',
    scope: 'game',
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
    scope: 'game',
    filePath
  });
  assert.equal(deployClaim.action, 'deploy');
  assert.equal(deployClaim.task.status, 'deploying');
  assert.equal(deployClaim.task.claimedBy, 'deploy-worker');

  const deployed = await updateAgentTask(created.id, {
    status: 'deployed',
    previousDeployCommitSha: 'base1234',
    newDeployCommitSha: 'abc1234',
    deployedAt: Date.now(),
    deployLog: 'mock deploy ok'
  }, { filePath });
  assert.equal(deployed.status, 'deployed');

  await recordAgentDeploymentState({
    action: 'deploy',
    taskId: created.id,
    previousCommitSha: 'base1234',
    currentCommitSha: 'abc1234'
  }, { filePath: deploymentFilePath });
  const deployment = await getAgentDeploymentState({ filePath: deploymentFilePath });
  assert.equal(deployment.currentTaskId, created.id);
  assert.equal(deployment.currentCommitSha, 'abc1234');

  const rollbackApproved = await approveAgentTaskRollback(created.id, {
    approvedBy: 'validator',
    filePath
  });
  assert.ok(rollbackApproved.rollbackApprovedAt > 0);

  const rollbackClaim = await claimNextAgentTask({
    workerId: 'rollback-worker',
    scope: 'game',
    filePath
  });
  assert.equal(rollbackClaim.action, 'rollback');
  assert.equal(rollbackClaim.task.status, 'rolling_back');
  assert.equal(rollbackClaim.task.claimedBy, 'rollback-worker');

  const rolledBack = await updateAgentTask(created.id, {
    status: 'rolled_back',
    rolledBackAt: Date.now(),
    rollbackCommitSha: 'rollback1234',
    rollbackLog: 'mock rollback ok'
  }, { filePath });
  assert.equal(rolledBack.status, 'rolled_back');
  assert.equal(rolledBack.rollbackCommitSha, 'rollback1234');

  await recordAgentDeploymentState({
    action: 'rollback',
    taskId: created.id,
    previousCommitSha: 'abc1234',
    currentCommitSha: 'rollback1234',
    rollbackCommitSha: 'rollback1234'
  }, { filePath: deploymentFilePath });
  const rollbackDeployment = await getAgentDeploymentState({ filePath: deploymentFilePath });
  assert.equal(rollbackDeployment.lastAction, 'rollback');
  assert.equal(rollbackDeployment.currentCommitSha, 'rollback1234');

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
