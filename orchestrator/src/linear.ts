import { config, required } from "./config.ts";
import { GAPS, type GapId } from "./tickets.ts";

type GraphQlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function linearGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = required("LINEAR_API_KEY");
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as GraphQlResponse<T>;
  if (!res.ok || body.errors?.length) {
    throw new Error(
      `Linear GraphQL failed: ${body.errors?.map((e) => e.message).join("; ") || res.statusText}`,
    );
  }
  if (!body.data) throw new Error("Linear GraphQL returned no data");
  return body.data;
}

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: { name: string };
};

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  url
  state { name }
`;

export async function getIssue(identifier: string): Promise<LinearIssue> {
  const data = await linearGql<{ issue: LinearIssue | null }>(
    `query ($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`,
    { id: identifier },
  );
  if (!data.issue) throw new Error(`Linear issue ${identifier} not found`);
  return data.issue;
}

async function labelIdsByName(names: string[]): Promise<string[]> {
  const data = await linearGql<{
    issueLabels: { nodes: Array<{ id: string; name: string }> };
  }>(
    `query ($names: [String!]!) {
      issueLabels(filter: { name: { in: $names } }) { nodes { id name } }
    }`,
    { names },
  );
  const found = new Map(data.issueLabels.nodes.map((n) => [n.name, n.id]));
  return names.map((name) => found.get(name)).filter((id): id is string => Boolean(id));
}

async function stateId(name: string): Promise<string> {
  const data = await linearGql<{
    team: { states: { nodes: Array<{ id: string; name: string }> } } | null;
  }>(
    `query ($id: String!) {
      team(id: $id) { states { nodes { id name } } }
    }`,
    { id: config.linearTeamId },
  );
  const match = data.team?.states.nodes.find((s) => s.name === name);
  if (!match) throw new Error(`Linear state "${name}" not found on team`);
  return match.id;
}

export async function createGapIssue(gapId: GapId): Promise<LinearIssue> {
  const gap = GAPS[gapId];
  const labels = await labelIdsByName(gap.labels);
  const data = await linearGql<{
    issueCreate: { success: boolean; issue: LinearIssue | null };
  }>(
    `mutation ($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } }
    }`,
    {
      input: {
        teamId: config.linearTeamId,
        projectId: config.linearProjectId,
        title: gap.title,
        labelIds: labels,
        description: gap.description,
      },
    },
  );
  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new Error(`Failed to create Linear issue for ${gapId} in project harbor`);
  }
  return data.issueCreate.issue;
}

export async function createControlGapIssue(): Promise<LinearIssue> {
  return createGapIssue("max-amount");
}

export async function setIssueState(issueId: string, stateName: string): Promise<void> {
  const id = await stateId(stateName);
  await linearGql(
    `mutation ($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }`,
    { id: issueId, stateId: id },
  );
}

export async function commentOnIssue(issueId: string, body: string): Promise<void> {
  await linearGql(
    `mutation ($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) { success }
    }`,
    { issueId, body },
  );
}
