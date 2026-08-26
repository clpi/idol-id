import test from "node:test";
import assert from "node:assert/strict";
import { observePublicRepository } from "../shared/repository.js";

test("provider default branches are bounded before revision lookup or persistence", async () => {
  const calls = [];
  await assert.rejects(
    () => observePublicRepository({ url: "https://github.com/acme/demo" }, {
      fetcher: async (url) => {
        calls.push(url);
        if (calls.length === 1) {
          return new Response(JSON.stringify({ private: false, default_branch: "x".repeat(161) }), {
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`revision lookup must not occur for invalid default branch: ${url}`);
      },
    }),
    (error) => error?.code === "INVALID_REPOSITORY_INPUT"
      && error?.status === 422
      && /default repository branch/i.test(error.message),
  );
  assert.deepEqual(calls, ["https://api.github.com/repos/acme/demo"]);
});
