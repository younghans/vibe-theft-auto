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
import {
  getAgentTaskCommitSubject,
  getAgentTaskPromptTitle
} from '../src/shared/agentTaskSummary.js';

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
  assert.equal(created.threadId, created.id);
  assert.equal(created.threadTitle, 'Make the teacher turn animation smoother.');
  assert.equal(created.scope, 'game');
  assert.equal(created.contextType, 'school_minigame');
  assert.equal(created.contextLabel, 'School: Teacher Is Looking');
  assert.equal(getAgentTaskPromptTitle(created), 'Make the teacher turn animation smoother');
  assert.equal(getAgentTaskCommitSubject(created), 'Agent task: Make the teacher turn animation smoother');

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
  assert.ok(claim.task.workStartedAt >= claim.task.claimedAt);

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
    commitSha: 'abc1234',
    changedFiles: ['src/game/Game.js', 'server/app.config.js'],
    deployTargets: ['frontend', 'backend'],
    agentMessage: 'I smoothed the teacher turn animation and kept the microgame timing intact.'
  }, { filePath });
  assert.equal(ready.status, 'ready_for_review');
  assert.equal(ready.agentMessage, 'I smoothed the teacher turn animation and kept the microgame timing intact.');
  assert.deepEqual(ready.changedFiles, ['src/game/Game.js', 'server/app.config.js']);
  assert.deepEqual(ready.deployTargets, ['frontend', 'backend']);
  assert.ok(ready.workCompletedAt >= ready.workStartedAt);
  const readyWorkCompletedAt = ready.workCompletedAt;

  const readyWithoutDeployApproval = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    contextLabel: 'Prompt console',
    prompt: 'Make prompt thread rows easier to scan.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  await updateAgentTask(readyWithoutDeployApproval.id, {
    status: 'ready_for_review',
    branch: 'agent/task-thread-base',
    commitSha: 'thread1234',
    agentMessage: 'Thread row polish is ready for review.'
  }, { filePath });
  const followup = await createAgentTask({
    parentTaskId: readyWithoutDeployApproval.id,
    prompt: 'Also show the latest agent completion in the detail panel.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  assert.equal(followup.threadId, readyWithoutDeployApproval.threadId);
  assert.equal(followup.parentTaskId, readyWithoutDeployApproval.id);
  assert.equal(followup.baseBranch, 'agent/task-thread-base');
  assert.equal(followup.baseCommitSha, 'thread1234');
  assert.equal(followup.threadHistory.length, 1);
  assert.equal(followup.threadHistory[0].agentMessage, 'Thread row polish is ready for review.');
  await cancelAgentTask(followup.id, {
    cancelledBy: 'validator',
    filePath
  });

  const approved = await approveAgentTaskDeploy(created.id, {
    approvedBy: 'validator',
    filePath
  });
  assert.ok(approved.deployApprovedAt > 0);

  await assert.rejects(
    createAgentTask({
      parentTaskId: created.id,
      prompt: 'Also make the classroom lights warmer.',
      mode: 'preview'
    }, {
      createdBy: 'validator',
      filePath
    }),
    /active worker run/u
  );

  const localOnlyTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Make prompt task cards easier to scan.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  const localClaim = await claimNextAgentTask({
    workerId: 'local-worker',
    scope: 'game',
    deployEnabled: false,
    filePath
  });
  assert.equal(localClaim.action, 'code_change');
  assert.equal(localClaim.task.id, localOnlyTask.id);
  const stillReady = await getAgentTask(created.id, { filePath });
  assert.equal(stillReady.status, 'ready_for_review');
  assert.ok(stillReady.deployApprovedAt > 0);
  assert.equal(stillReady.workCompletedAt, readyWorkCompletedAt);

  const deployClaim = await claimNextAgentTask({
    workerId: 'deploy-worker',
    scope: 'game',
    filePath
  });
  assert.equal(deployClaim.action, 'deploy');
  assert.equal(deployClaim.task.status, 'deploying');
  assert.equal(deployClaim.task.claimedBy, 'deploy-worker');
  await updateAgentTask(created.id, {
    deployStartedAt: Date.now() - 60000
  }, { filePath });
  const reconcileClaim = await claimNextAgentTask({
    workerId: 'reconcile-worker',
    scope: 'game',
    staleDeployingAfterMs: 1,
    filePath
  });
  assert.equal(reconcileClaim.action, 'reconcile_deploy');
  assert.equal(reconcileClaim.task.status, 'deploying');
  assert.equal(reconcileClaim.task.claimedBy, 'reconcile-worker');

  const deployed = await updateAgentTask(created.id, {
    status: 'deployed',
    previousDeployCommitSha: 'base1234',
    newDeployCommitSha: 'abc1234',
    deployedAt: Date.now(),
    deployLog: 'mock deploy ok',
    deployTargets: ['frontend']
  }, { filePath });
  assert.equal(deployed.status, 'deployed');
  assert.deepEqual(deployed.deployTargets, ['frontend']);

  await recordAgentDeploymentState({
    action: 'deploy',
    taskId: created.id,
    previousCommitSha: 'base1234',
    currentCommitSha: 'abc1234',
    deployTargets: ['frontend']
  }, { filePath: deploymentFilePath });
  const deployment = await getAgentDeploymentState({ filePath: deploymentFilePath });
  assert.equal(deployment.currentTaskId, created.id);
  assert.equal(deployment.currentCommitSha, 'abc1234');
  assert.deepEqual(deployment.history.at(-1).deployTargets, ['frontend']);

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
