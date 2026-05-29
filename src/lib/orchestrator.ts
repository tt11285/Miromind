import { createFixtureArtifacts } from "@/data/fixtures";
import {
  defaultResearchTask,
  getCompany,
  getQuestionTemplate
} from "./researchConfig";
import { scoreResearchArtifacts } from "./scoring";
import type {
  ResearchRun,
  ResearchTask,
  RunPhase
} from "./types";

export type ResearchReasoner = (input: {
  task: ResearchTask;
  rootQuestion: string;
  nodeLabels: string[];
}) => Promise<{ summary: string }>;

interface RunResearchOptions {
  reasoner?: ResearchReasoner;
}

const completePhases: RunPhase[] = [
  {
    name: "Task Framing",
    status: "complete",
    detail: "Resolved the company, question template, and time horizon."
  },
  {
    name: "Hypothesis Generation",
    status: "complete",
    detail: "Created five weighted hypothesis nodes for the research question."
  },
  {
    name: "Evidence Collection",
    status: "complete",
    detail: "Loaded fixture evidence cards linked to hypothesis nodes."
  },
  {
    name: "Evidence Scoring",
    status: "complete",
    detail: "Scored evidence quality, direction, and node-level confidence."
  },
  {
    name: "Reasoning Synthesis",
    status: "complete",
    detail: "Synthesized node conclusions into an investment stance."
  },
  {
    name: "Memo Rendering",
    status: "complete",
    detail: "Rendered the scored conclusions into memo sections."
  }
];

export async function runResearch(
  task: ResearchTask,
  options: RunResearchOptions = {}
): Promise<ResearchRun> {
  const artifacts = createFixtureArtifacts(task);
  const rootQuestion = rootQuestionForTask(task, artifacts.rootQuestion);
  const scored = scoreResearchArtifacts(artifacts.nodes, artifacts.evidence);
  const memo = scored.memo;

  if (options.reasoner) {
    const note = await options.reasoner({
      task,
      rootQuestion,
      nodeLabels: artifacts.nodes.map((node) => node.label)
    });
    memo.sections[0] = {
      ...memo.sections[0],
      body: `${memo.sections[0].body}\n\n${note.summary}`
    };
  }

  return {
    task,
    rootQuestion,
    phases: completePhases.map((phase) => ({ ...phase })),
    nodes: scored.nodes,
    evidence: artifacts.evidence,
    memo,
    mode: options.reasoner ? "miromind-augmented" : "fixture"
  };
}

function rootQuestionForTask(task: ResearchTask, fixtureRootQuestion: string): string {
  if (isDefaultTask(task)) {
    return fixtureRootQuestion;
  }

  const company = getCompany(task.companyId);
  const template = getQuestionTemplate(task.questionTemplateId);

  return `${company.name} (${company.ticker}) over ${task.timeHorizon}: ${template.rootQuestion}`;
}

function isDefaultTask(task: ResearchTask): boolean {
  return (
    task.companyId === defaultResearchTask.companyId &&
    task.questionTemplateId === defaultResearchTask.questionTemplateId &&
    task.timeHorizon === defaultResearchTask.timeHorizon &&
    task.evidencePreference === defaultResearchTask.evidencePreference
  );
}
