/** What the game knows about the player: counters (events seen, things placed, credits ...), owned preset ids, finished quests. */
export interface PlayerState {
  counts: Record<string, number>;
  owns: string[];
  done: string[];
}

/** A condition, as data (never code). */
export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { count: string; atLeast: number } // counts[count] >= atLeast (missing = 0)
  | { owns: string }
  | { done: string };

export interface Reward {
  credits?: number;
  presets?: string[];
  unlock?: string[];
} // unlock: names of features (e.g. "portal", "class:shaman")

export interface Step {
  id: string;
  text: string;
  target?: string;
  until: Cond;
} // target: a UI name the game highlights

export interface Quest {
  id: string;
  title: string;
  requires?: Cond;
  steps: Step[];
  reward: Reward;
}

export interface Questline {
  id: string;
  title: string;
  quests: Quest[];
}

export interface Progress {
  quest: string | null;
  step: number;
  finished: string[];
  rewarded: string[];
}

export const START: Progress = {
  quest: null,
  step: 0,
  finished: [],
  rewarded: [],
};

export function check(c: Cond, s: PlayerState): boolean {
  if ('all' in c) {
    return c.all.every((sub) => check(sub, s));
  }
  if ('any' in c) {
    return c.any.some((sub) => check(sub, s));
  }
  if ('not' in c) {
    return !check(c.not, s);
  }
  if ('count' in c) {
    const val = s.counts[c.count] ?? 0;
    return val >= c.atLeast;
  }
  if ('owns' in c) {
    return s.owns.includes(c.owns);
  }
  if ('done' in c) {
    return s.done.includes(c.done);
  }
  return false;
}

function checkCondStructure(
  c: unknown,
  depth: number,
  knownQuests: Set<string>,
  problems: string[]
): void {
  if (depth > 16) {
    problems.push('Condition depth exceeds maximum allowed depth of 16');
    return;
  }
  if (!c || typeof c !== 'object') {
    problems.push('Condition must be a non-null object');
    return;
  }
  const obj = c as Record<string, unknown>;
  const hasAll = 'all' in obj;
  const hasAny = 'any' in obj;
  const hasNot = 'not' in obj;
  const hasCount = 'count' in obj;
  const hasOwns = 'owns' in obj;
  const hasDone = 'done' in obj;

  const count =
    (hasAll ? 1 : 0) +
    (hasAny ? 1 : 0) +
    (hasNot ? 1 : 0) +
    (hasCount ? 1 : 0) +
    (hasOwns ? 1 : 0) +
    (hasDone ? 1 : 0);

  if (count !== 1) {
    problems.push('Condition must contain exactly one recognized discriminant');
    return;
  }

  if (hasAll) {
    const arr = obj['all'];
    if (!Array.isArray(arr)) {
      problems.push('Condition "all" must be an array');
    } else {
      for (const item of arr) {
        checkCondStructure(item, depth + 1, knownQuests, problems);
      }
    }
    return;
  }

  if (hasAny) {
    const arr = obj['any'];
    if (!Array.isArray(arr)) {
      problems.push('Condition "any" must be an array');
    } else {
      for (const item of arr) {
        checkCondStructure(item, depth + 1, knownQuests, problems);
      }
    }
    return;
  }

  if (hasNot) {
    const sub = obj['not'];
    if (!sub || typeof sub !== 'object') {
      problems.push('Condition "not" must be a non-null object');
    } else {
      checkCondStructure(sub, depth + 1, knownQuests, problems);
    }
    return;
  }

  if (hasCount) {
    const countKey = obj['count'];
    const atLeast = obj['atLeast'];
    if (typeof countKey !== 'string' || typeof atLeast !== 'number' || !Number.isFinite(atLeast)) {
      problems.push('Condition "count" requires a string "count" and finite number "atLeast"');
    }
    return;
  }

  if (hasOwns) {
    const ownsKey = obj['owns'];
    if (typeof ownsKey !== 'string') {
      problems.push('Condition "owns" requires a string property');
    }
    return;
  }

  if (hasDone) {
    const doneKey = obj['done'];
    if (typeof doneKey !== 'string') {
      problems.push('Condition "done" requires a string property');
    } else if (!knownQuests.has(doneKey)) {
      problems.push(`Condition "done" references unknown quest "${doneKey}"`);
    }
    return;
  }
}

/** Validate untrusted questline data: unique quest and step ids, every quest has at least one step, conditions well formed (depth at most 16), no `done` naming an unknown quest, rewards non-negative. Returns problems (empty = good). */
export function validate(q: Questline): string[] {
  const problems: string[] = [];
  const knownQuests = new Set<string>();
  for (const quest of q.quests) {
    if (quest && typeof quest.id === 'string') {
      knownQuests.add(quest.id);
    }
  }

  const seenQuestIds = new Set<string>();
  const seenStepIds = new Set<string>();

  for (const quest of q.quests) {
    if (seenQuestIds.has(quest.id)) {
      problems.push(`Duplicate quest id: "${quest.id}"`);
    }
    seenQuestIds.add(quest.id);

    if (!quest.steps || quest.steps.length === 0) {
      problems.push(`Quest "${quest.id}" must have at least one step`);
    } else {
      for (const step of quest.steps) {
        if (seenStepIds.has(step.id)) {
          problems.push(`Duplicate step id: "${step.id}"`);
        }
        seenStepIds.add(step.id);
        checkCondStructure(step.until, 1, knownQuests, problems);
      }
    }

    if (quest.requires) {
      checkCondStructure(quest.requires, 1, knownQuests, problems);
    }

    if (quest.reward) {
      if (
        quest.reward.credits !== undefined &&
        (typeof quest.reward.credits !== 'number' ||
          !Number.isFinite(quest.reward.credits) ||
          quest.reward.credits < 0)
      ) {
        problems.push(
          `Quest "${quest.id}" reward credits must be a non-negative finite number`
        );
      }
    }
  }

  return problems;
}

/** The first quest that is not finished and whose `requires` holds (in order), or null. */
export function current(q: Questline, s: PlayerState, p: Progress): string | null {
  for (const quest of q.quests) {
    if (p.finished.includes(quest.id)) {
      continue;
    }
    if (quest.requires && !check(quest.requires, s)) {
      continue;
    }
    return quest.id;
  }
  return null;
}

/** Advance: while the current step's `until` holds, move to the next step; a finished quest goes into `finished` (and `s.done` is the caller's job), then the next quest starts at step 0. Returns the new progress and the rewards earned this time (each quest pays once: `rewarded`). Never loops forever. */
export function advance(
  q: Questline,
  s: PlayerState,
  p: Progress
): { progress: Progress; rewards: Reward[] } {
  const finished = [...p.finished];
  const rewarded = [...p.rewarded];
  const earnedRewards: Reward[] = [];

  let activeQuestId = p.quest;
  let activeStep = p.step;

  if (
    activeQuestId === null ||
    finished.includes(activeQuestId) ||
    !q.quests.some((quest) => quest.id === activeQuestId)
  ) {
    activeQuestId = current(q, s, { quest: null, step: 0, finished, rewarded });
    activeStep = 0;
  }

  const maxIterations = q.quests.reduce((acc, quest) => acc + quest.steps.length + 1, 1);
  let iterations = 0;

  while (activeQuestId !== null && iterations++ < maxIterations) {
    const quest = q.quests.find((questItem) => questItem.id === activeQuestId);
    if (!quest) {
      break;
    }

    if (quest.requires && !check(quest.requires, s)) {
      break;
    }

    if (activeStep < 0) {
      activeStep = 0;
    }

    while (activeStep < quest.steps.length) {
      const step = quest.steps[activeStep];
      if (!step || !check(step.until, s)) {
        break;
      }
      activeStep++;
    }

    if (activeStep >= quest.steps.length) {
      if (!finished.includes(quest.id)) {
        finished.push(quest.id);
      }
      if (!rewarded.includes(quest.id)) {
        rewarded.push(quest.id);
        earnedRewards.push(quest.reward);
      }
      activeQuestId = current(q, s, { quest: null, step: 0, finished, rewarded });
      activeStep = 0;
    } else {
      break;
    }
  }

  return {
    progress: {
      quest: activeQuestId,
      step: activeStep,
      finished,
      rewarded,
    },
    rewards: earnedRewards,
  };
}

/** Skip the current step (the tour's Skip button). */
export function skip(q: Questline, p: Progress): Progress {
  if (p.quest === null) {
    return { ...p, finished: [...p.finished], rewarded: [...p.rewarded] };
  }
  const questIndex = q.quests.findIndex((quest) => quest.id === p.quest);
  if (questIndex === -1) {
    return { ...p, finished: [...p.finished], rewarded: [...p.rewarded] };
  }
  const currentQuest = q.quests[questIndex];
  if (!currentQuest) {
    return { ...p, finished: [...p.finished], rewarded: [...p.rewarded] };
  }

  if (p.step + 1 < currentQuest.steps.length) {
    return {
      quest: p.quest,
      step: p.step + 1,
      finished: [...p.finished],
      rewarded: [...p.rewarded],
    };
  }

  const finished = p.finished.includes(currentQuest.id)
    ? [...p.finished]
    : [...p.finished, currentQuest.id];

  const nextQuest = q.quests
    .slice(questIndex + 1)
    .find((quest) => !finished.includes(quest.id));

  return {
    quest: nextQuest ? nextQuest.id : null,
    step: 0,
    finished,
    rewarded: [...p.rewarded],
  };
}

/** Every UI target named in the questline (the game checks each exists on screen). */
export function targets(q: Questline): string[] {
  const result: string[] = [];
  for (const quest of q.quests) {
    for (const step of quest.steps) {
      if (step.target !== undefined && !result.includes(step.target)) {
        result.push(step.target);
      }
    }
  }
  return result;
}