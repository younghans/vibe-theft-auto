const DEFAULT_AGENT_TASK_PROMPT_TITLE = 'Game prompt';
const DEFAULT_AGENT_TASK_TITLE_MAX_LENGTH = 76;
const DEFAULT_AGENT_TASK_COMMIT_TITLE_MAX_LENGTH = 58;
const AGENT_TASK_COMMIT_PREFIX = 'Agent task: ';

function normalizePromptText(value = '') {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function uppercaseFirstLetter(value = '') {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function truncateAtWord(value = '', maxLength = DEFAULT_AGENT_TASK_TITLE_MAX_LENGTH) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const wordBoundary = clipped.lastIndexOf(' ');
  const truncated = wordBoundary >= Math.floor(maxLength * 0.58)
    ? clipped.slice(0, wordBoundary)
    : clipped;
  return `${truncated.replace(/[,.!?;:]+$/u, '')}...`;
}

function getFirstPromptPhrase(value = '') {
  const text = normalizePromptText(value);
  if (!text) {
    return '';
  }

  const sentenceMatch = text.match(/^(.{18,}?[.!?])(?:\s|$)/iu);
  if (sentenceMatch?.[1]) {
    return sentenceMatch[1].replace(/[.!?]+$/u, '');
  }

  return text;
}

export function getAgentTaskPromptTitle(taskOrPrompt = '', {
  fallback = DEFAULT_AGENT_TASK_PROMPT_TITLE,
  maxLength = DEFAULT_AGENT_TASK_TITLE_MAX_LENGTH
} = {}) {
  const prompt = typeof taskOrPrompt === 'object' && taskOrPrompt
    ? taskOrPrompt.prompt
    : taskOrPrompt;
  const phrase = getFirstPromptPhrase(prompt);
  return truncateAtWord(uppercaseFirstLetter(phrase || fallback), maxLength) || fallback;
}

export function getAgentTaskCommitSubject(task = {}) {
  const title = getAgentTaskPromptTitle(task, {
    maxLength: DEFAULT_AGENT_TASK_COMMIT_TITLE_MAX_LENGTH
  });
  return truncateAtWord(`${AGENT_TASK_COMMIT_PREFIX}${title}`, 72);
}

export function getAgentTaskCommitBody(task = {}, changedFiles = []) {
  const prompt = normalizePromptText(task.prompt);
  const files = Array.isArray(changedFiles)
    ? changedFiles.map((filePath) => String(filePath ?? '').trim()).filter(Boolean)
    : [];
  return [
    `Task ID: ${String(task.id ?? '').trim() || 'unknown'}`,
    prompt ? `Prompt: ${truncateAtWord(prompt, 240)}` : '',
    files.length ? `Changed files:\n${files.map((filePath) => `- ${filePath}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}
