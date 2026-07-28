export type CommentDraft = {
  author: string;
  content: string;
};

export async function submitComment(
  draft: CommentDraft,
  save: (draft: CommentDraft) => Promise<void>,
  reset: () => void,
) {
  await save(draft);
  reset();
}
