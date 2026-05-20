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
  getAgentTaskThread,
  listAgentTaskThreads,
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

const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vta-agent-tasks-'));
const filePath = path.join(tempRoot, 'agent-tasks.json');
const deploymentFilePath = path.join(tempRoot, 'agent-deployments.json');
const hudSource = await fsp.readFile(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
const agentWorkerSource = await fsp.readFile(new URL('./agent-worker.mjs', import.meta.url), 'utf8');

try {
  assert.match(hudSource, /deploy_queued:\s*'Deploy Queued'/, 'HUD should label approved pending deploys as deploy queued.');
  assert.match(hudSource, /worker_offline:\s*'Worker Offline'/, 'HUD should label stale worker heartbeats as offline.');
  assert.match(hudSource, /reconciling_deploy:\s*'Reconciling'/, 'HUD should label interrupted deploy reconciliation.');
  assert.match(hudSource, /isAgentTaskDeployQueued/, 'HUD should derive deploy queued from task metadata.');
  assert.match(hudSource, /isAgentTaskWorkerOffline/, 'HUD should derive worker offline state from task heartbeats.');
  assert.match(hudSource, /deployApprovedAt[\s\S]*deployStartedAt/, 'HUD deploy queued detection should require approval before deploy start.');
  assert.match(hudSource, /hasMoreThreads/, 'HUD should use server pagination metadata for prompt thread load-more.');
  assert.match(hudSource, /onLoadMore/, 'HUD should notify the game when prompt threads request more rows.');
  assert.match(hudSource, /lastAdminPromptBottomScrollSignature/, 'HUD should track prompt thread bottom scroll state.');
  assert.match(hudSource, /isAdminPromptDetailNearBottom/, 'HUD should only follow same-thread updates when the reader is near the bottom.');
  assert.match(agentWorkerSource, /\$isTaskRelated = \$false/, 'Worker process cleanup should track whether a process belongs to the current task.');
  assert.match(agentWorkerSource, /\$includeDetachedLocalHelpers -and \$isNew -and \$isTaskRelated/, 'Worker cleanup should only kill detached helpers related to the current task.');

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
  let foundValidationLog = false;
  for (const entry of logged.logs) {
    if (entry.message === 'Validation log entry.') {
      foundValidationLog = true;
      break;
    }
  }
  assert.ok(foundValidationLog);

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
  const compactThreadSummaries = await listAgentTaskThreads({
    scope: 'game',
    limit: 5,
    compact: true,
    filePath
  });
  let compactPromptThread = null;
  for (const task of compactThreadSummaries) {
    if (task.threadId === readyWithoutDeployApproval.threadId) {
      compactPromptThread = task;
      break;
    }
  }
  assert.ok(compactPromptThread, 'Prompt thread summaries should include latest tasks per thread.');
  assert.equal(compactPromptThread.logs, undefined);
  assert.equal(compactPromptThread.snapshot, undefined);
  assert.equal(compactPromptThread.threadHistory, undefined);
  assert.equal(compactPromptThread.agentMessage, undefined);
  const firstPromptThreadPage = await listAgentTaskThreads({
    scope: 'game',
    limit: 1,
    offset: 0,
    compact: true,
    filePath
  });
  const secondPromptThreadPage = await listAgentTaskThreads({
    scope: 'game',
    limit: 1,
    offset: 1,
    compact: true,
    filePath
  });
  assert.equal(firstPromptThreadPage.length, 1);
  assert.equal(secondPromptThreadPage.length, 1);
  assert.notEqual(firstPromptThreadPage[0].threadId, secondPromptThreadPage[0].threadId);
  const compactPromptThreadTasks = await getAgentTaskThread(readyWithoutDeployApproval.id, {
    compact: true,
    filePath
  });
  assert.equal(compactPromptThreadTasks.length, 2);
  assert.equal(compactPromptThreadTasks[0].agentMessage, 'Thread row polish is ready for review.');
  assert.equal(compactPromptThreadTasks[0].logs, undefined);
  assert.equal(compactPromptThreadTasks[0].snapshot, undefined);

  const deployedThreadUpdate = await createAgentTask({
    parentTaskId: readyWithoutDeployApproval.id,
    prompt: 'Ship the prompt detail panel polish.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  await updateAgentTask(deployedThreadUpdate.id, {
    status: 'deployed',
    branch: 'agent/task-thread-deployed',
    commitSha: 'threaddeployed1234',
    newDeployCommitSha: 'maindeployed5678',
    agentMessage: 'Prompt detail polish is deployed.'
  }, { filePath });
  const deployedFollowup = await createAgentTask({
    parentTaskId: deployedThreadUpdate.id,
    prompt: 'Continue from the deployed prompt detail polish.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  assert.equal(deployedFollowup.threadId, readyWithoutDeployApproval.threadId);
  assert.equal(deployedFollowup.parentTaskId, deployedThreadUpdate.id);
  assert.equal(deployedFollowup.baseBranch, '');
  assert.equal(deployedFollowup.baseCommitSha, 'maindeployed5678');
  assert.equal(deployedFollowup.threadHistory.at(-1).status, 'deployed');
  await cancelAgentTask(deployedFollowup.id, {
    cancelledBy: 'validator',
    filePath
  });

  const laneBoundaryTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Keep deploy workers from claiming code tasks.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  const disabledClaim = await claimNextAgentTask({
    workerId: 'disabled-worker',
    scope: 'game',
    deployEnabled: false,
    codeEnabled: false,
    filePath
  });
  assert.equal(disabledClaim.action, '');
  assert.equal(disabledClaim.task, null);
  const deployOnlyIdle = await claimNextAgentTask({
    workerId: 'deploy-only-worker',
    scope: 'game',
    codeEnabled: false,
    filePath
  });
  assert.equal(deployOnlyIdle.action, '');
  assert.equal(deployOnlyIdle.task, null);
  const codeLaneClaim = await claimNextAgentTask({
    workerId: 'code-lane-worker',
    scope: 'game',
    deployEnabled: false,
    filePath
  });
  assert.equal(codeLaneClaim.action, 'code_change');
  assert.equal(codeLaneClaim.task.id, laneBoundaryTask.id);
  await cancelAgentTask(laneBoundaryTask.id, {
    cancelledBy: 'validator',
    filePath
  });

  const heartbeatTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Fail stale coding tasks when worker heartbeat expires.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  const heartbeatClaim = await claimNextAgentTask({
    workerId: 'heartbeat-worker',
    scope: 'game',
    deployEnabled: false,
    workerHeartbeatEnabled: true,
    filePath
  });
  assert.equal(heartbeatClaim.action, 'code_change');
  assert.equal(heartbeatClaim.task.id, heartbeatTask.id);
  assert.ok(heartbeatClaim.task.workerHeartbeatAt >= heartbeatClaim.task.claimedAt);
  await updateAgentTask(heartbeatTask.id, {
    status: 'coding',
    workerHeartbeatAt: Date.now() - 60000,
    workerHeartbeatStatus: 'coding'
  }, { filePath });
  const staleHeartbeatTasks = await listAgentTasks({
    scope: 'game',
    staleActiveAfterMs: 1,
    filePath
  });
  let failedHeartbeatTask = null;
  for (const task of staleHeartbeatTasks) {
    if (task.id === heartbeatTask.id) {
      failedHeartbeatTask = task;
      break;
    }
  }
  assert.equal(failedHeartbeatTask.status, 'failed');
  assert.match(failedHeartbeatTask.error, /heartbeat expired/u);

  const legacyActiveTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Keep old active tasks without heartbeat from immediate stale failure.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  const legacyClaim = await claimNextAgentTask({
    workerId: 'legacy-worker',
    scope: 'game',
    deployEnabled: false,
    filePath
  });
  assert.equal(legacyClaim.task.id, legacyActiveTask.id);
  await updateAgentTask(legacyActiveTask.id, {
    status: 'coding'
  }, { filePath });
  const legacyAfterStaleSweep = await getAgentTask(legacyActiveTask.id, {
    staleActiveAfterMs: 1,
    filePath
  });
  assert.equal(legacyAfterStaleSweep.status, 'coding');
  await cancelAgentTask(legacyActiveTask.id, {
    cancelledBy: 'validator',
    filePath
  });

  const retryDeployTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Do not allow a failed deploy to be approved again.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  await updateAgentTask(retryDeployTask.id, {
    status: 'ready_for_review',
    branch: 'agent/task-retry-deploy',
    commitSha: 'retry1234',
    changedFiles: ['src/ui/Hud.js'],
    deployTargets: ['frontend'],
    agentMessage: 'Retry deploy task is ready.'
  }, { filePath });
  const retryApprovedInitial = await approveAgentTaskDeploy(retryDeployTask.id, {
    approvedBy: 'validator',
    filePath
  });
  const retryClaim = await claimNextAgentTask({
    workerId: 'retry-deploy-worker',
    scope: 'game',
    codeEnabled: false,
    filePath
  });
  assert.equal(retryClaim.action, 'deploy');
  assert.equal(retryClaim.task.id, retryDeployTask.id);
  await updateAgentTask(retryDeployTask.id, {
    status: 'failed',
    error: 'deploy rebase conflict'
  }, { filePath });
  await assert.rejects(
    () => approveAgentTaskDeploy(retryDeployTask.id, {
      approvedBy: 'validator',
      filePath
    }),
    /Only ready-for-review tasks can be approved for deploy/
  );
  const retryRejected = await getAgentTask(retryDeployTask.id, {
    filePath
  });
  assert.equal(retryRejected.status, 'failed');
  assert.equal(retryRejected.error, 'deploy rebase conflict');
  assert.ok(retryRejected.deployStartedAt > 0);
  assert.equal(retryRejected.deployApprovedAt, retryApprovedInitial.deployApprovedAt);
  const retryReady = await updateAgentTask(retryDeployTask.id, {
    status: 'ready_for_review',
    error: '',
    summary: 'Deploy was manually verified and is ready for fresh approval.'
  }, { filePath });
  assert.equal(retryReady.status, 'ready_for_review');
  assert.equal(retryReady.error, '');
  assert.equal(retryReady.deployApprovedAt, 0);
  assert.equal(retryReady.deployApprovedBy, '');
  assert.equal(retryReady.deployStartedAt, 0);
  assert.equal(retryReady.claimedBy, '');
  assert.equal(retryReady.claimedAt, 0);
  assert.equal(retryReady.workerHeartbeatAt, 0);
  assert.equal(retryReady.workerHeartbeatStatus, '');
  let staleApprovalLogFound = false;
  for (const entry of retryReady.logs) {
    if (/stale deploy approval cleared/u.test(entry.message)) {
      staleApprovalLogFound = true;
      break;
    }
  }
  assert.ok(staleApprovalLogFound);
  const retryApprovedAgain = await approveAgentTaskDeploy(retryDeployTask.id, {
    approvedBy: 'validator',
    filePath
  });
  assert.ok(retryApprovedAgain.deployApprovedAt > 0);
  await cancelAgentTask(retryDeployTask.id, {
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
    workerHeartbeatEnabled: true,
    filePath
  });
  assert.equal(deployClaim.action, 'deploy');
  assert.equal(deployClaim.task.status, 'deploying');
  assert.equal(deployClaim.task.claimedBy, 'deploy-worker');
  assert.ok(deployClaim.task.workerHeartbeatAt >= deployClaim.task.claimedAt);
  assert.equal(deployClaim.task.workerHeartbeatStatus, 'deploying');
  const blockedParallelDeployTask = await createAgentTask({
    scope: 'game',
    contextType: 'hud',
    prompt: 'Queue a second approved deploy while one is already deploying.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  await updateAgentTask(blockedParallelDeployTask.id, {
    status: 'ready_for_review',
    commitSha: 'def5678',
    deployTargets: ['frontend'],
    agentMessage: 'Second deploy is ready.'
  }, { filePath });
  await approveAgentTaskDeploy(blockedParallelDeployTask.id, {
    approvedBy: 'validator',
    filePath
  });
  const blockedDeployClaim = await claimNextAgentTask({
    workerId: 'parallel-deploy-worker',
    scope: 'game',
    codeEnabled: false,
    filePath
  });
  assert.equal(blockedDeployClaim.action, '');
  assert.equal(blockedDeployClaim.task, null);
  await cancelAgentTask(blockedParallelDeployTask.id, {
    cancelledBy: 'validator',
    filePath
  });

  const offScopeStaleDeployTask = await createAgentTask({
    scope: 'school_minigame',
    contextType: 'hud',
    prompt: 'Keep stale deploy reconciliation scoped to this lane.',
    mode: 'preview'
  }, {
    createdBy: 'validator',
    filePath
  });
  await updateAgentTask(offScopeStaleDeployTask.id, {
    status: 'deploying',
    branch: 'agent/task-off-scope-stale',
    commitSha: 'offscope1234',
    deployStartedAt: Date.now() - 60000
  }, { filePath });
  const scopedReconcileClaim = await claimNextAgentTask({
    workerId: 'scoped-reconcile-worker',
    scope: 'game',
    staleDeployingAfterMs: 30000,
    codeEnabled: false,
    filePath
  });
  assert.equal(scopedReconcileClaim.action, '');
  assert.equal(scopedReconcileClaim.task, null);
  await cancelAgentTask(offScopeStaleDeployTask.id, {
    cancelledBy: 'validator',
    filePath
  });

  await updateAgentTask(created.id, {
    deployStartedAt: Date.now() - 60000,
    workerHeartbeatAt: Date.now(),
    workerHeartbeatStatus: 'deploying'
  }, { filePath });
  const recentDeployHeartbeatClaim = await claimNextAgentTask({
    workerId: 'recent-deploy-heartbeat-worker',
    scope: 'game',
    staleDeployingAfterMs: 30000,
    codeEnabled: false,
    workerHeartbeatEnabled: true,
    filePath
  });
  assert.equal(recentDeployHeartbeatClaim.action, '');
  assert.equal(recentDeployHeartbeatClaim.task, null);

  await updateAgentTask(created.id, {
    workerHeartbeatAt: Date.now() - 60000,
    workerHeartbeatStatus: 'deploying'
  }, { filePath });
  const reconcileClaim = await claimNextAgentTask({
    workerId: 'reconcile-worker',
    scope: 'game',
    staleDeployingAfterMs: 30000,
    codeEnabled: false,
    workerHeartbeatEnabled: true,
    filePath
  });
  assert.equal(reconcileClaim.action, 'reconcile_deploy');
  assert.equal(reconcileClaim.task.status, 'deploying');
  assert.equal(reconcileClaim.task.claimedBy, 'reconcile-worker');
  assert.equal(reconcileClaim.task.workerHeartbeatStatus, 'reconciling_deploy');

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
