import { getInput } from "@actions/core";
import { context, getOctokit } from "@actions/github";

export const setTimeoutAsync = <CallbackType extends () => any>(
  callback: CallbackType,
  timeout: number
) =>
  new Promise<ReturnType<CallbackType>>((resolve) =>
    setTimeout(() => resolve(callback()), timeout)
  );

export const getInputArgs = () => {
  const {
    repo: { owner, repo },
    ref,
  } = context;
  const [branch] = ref.match(/(?<=refs\/heads\/).+/g) ?? [];

  if (!branch) {
    throw new Error("No branch found");
  }

  return {
    token: getInput("token", { required: true }),
    retryInterval: Number(getInput("retryInterval")),
    repo,
    owner,
    branch,
  };
};

type QueryResultRateLimit = {
  rateLimit: {
    cost: number;
    remaining: number;
    resetAt: string;
  };
};
export type QueryResult<T = {}> = QueryResultRateLimit & T;

export const waitForRateLimitReset = async <
  QueryResultType extends QueryResult,
>(
  result: QueryResultType
) => {
  const { cost, remaining, resetAt } = result.rateLimit;
  if (remaining >= cost) return;

  const timeToRateLimitReset =
    new Date(resetAt).getTime() - new Date().getTime();
  await setTimeoutAsync(() => true, timeToRateLimitReset);
};
export const tryGetResult = async <
  Result extends QueryResult,
  Args extends Record<string, unknown> = Record<string, unknown>,
>(
  query: string,
  args: Args,
  condition: (result: Result) => boolean
) => {
  const octokit = getOctokit(getInputArgs().token);

  const result = await octokit.graphql<Result>(query, args);
  await waitForRateLimitReset(result);

  if (condition(result)) {
    return result;
  }

  return undefined;
};
