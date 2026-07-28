import assert from "node:assert/strict";
import test from "node:test";
import { submitComment } from "../lib/comment-submit";

test("clears the composer after a comment is saved", async () => {
  let resetCount = 0;
  let saved: { author: string; content: string } | undefined;

  await submitComment(
    { author: "태지", content: "점심은 여기 어때?" },
    async (comment) => { saved = comment; },
    () => { resetCount += 1; },
  );

  assert.deepEqual(saved, { author: "태지", content: "점심은 여기 어때?" });
  assert.equal(resetCount, 1);
});
