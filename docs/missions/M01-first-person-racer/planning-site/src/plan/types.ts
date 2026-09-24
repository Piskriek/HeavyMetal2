export type Verdict = 'accept' | 'amend' | 'reject';

export interface Decision {
  id: string;
  title: string;
  verdict: Verdict;
  choice: string;
  reason: string;
  frozen: string[];
  reqs: string[];
}

export interface FrozenInterface {
  id: string;
  file: string;
  ticket: string;
  summary: string;
  code: string;
}

export interface Ticket {
  id: string;
  title: string;
  reqs: string[];
  decisions: string[];
  goal: string;
  dependsOn: string[];
  create: string[];
  modify: string[];
  interfaces: string[];
  behaviour: string[];
  acceptance: string[];
  tests: { suite: string; names: string[] }[];
  verify: string[];
  outOfScope: string[];
  art?: string[];
  unverifiable: string[];
}

export interface Risk {
  id: string;
  ref: string;
  risk: string;
  mitigation: string;
  severity: 'high' | 'medium' | 'low';
}

export interface Question {
  id: string;
  question: string;
  defaultAnswer: string;
  blocks: string;
}
