export type CommentDraft = {
  author: string;
  content: string;
};

export async function submitComment(
  draft: CommentDraft,
  save: (draft: CommentDraft) => Promise<void>,
): Promise<CommentDraft> {
  await save(draft);
  return { ...draft, content: "" };
}
