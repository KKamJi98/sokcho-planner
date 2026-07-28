import assert from "node:assert/strict";
import test from "node:test";
import { submitComment } from "../lib/comment-submit";

test("clears only the message after a comment is saved", async () => {
  let saved: { author: string; content: string } | undefined;

  const cleared = await submitComment(
    { author: "태지", content: "점심은 여기 어때?" },
    async (comment) => { saved = comment; },
  );

  assert.deepEqual(saved, { author: "태지", content: "점심은 여기 어때?" });
  assert.deepEqual(cleared, { author: "태지", content: "" });
});
