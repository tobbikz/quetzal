import { ReplyComposer } from '@/components/ReplyComposer';
import { Markdown, type MentionPerson } from '@/components/Markdown';
import { WikiHtml } from '@/components/WikiHtml';
import { formatWhen } from '@/lib/format';
import type { Comment } from '@/lib/types';

function isHtmlBody(source: string): boolean {
  return /^\s*</.test(source) || /<\/(p|h[1-6]|ul|ol|li|blockquote|pre|strong|em|a)\b/i.test(source);
}

const MAX_VISUAL_DEPTH = 6;

type Action = (formData: FormData) => void | Promise<void>;

export interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

export function commentForest(comments: Comment[]): CommentNode[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const byParent = new Map<number | null, Comment[]>();
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  for (const comment of ordered) {
    const parent = comment.parentId != null && ids.has(comment.parentId) ? comment.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(comment);
    byParent.set(parent, list);
  }
  const nest = (parentId: number | null): CommentNode[] =>
    (byParent.get(parentId) ?? []).map((comment) => ({
      comment,
      replies: nest(comment.id),
    }));
  return nest(null);
}

export function CommentThread({
  node,
  depth,
  names,
  people,
  issueKey,
  tab,
  replyAs,
  action,
}: {
  node: CommentNode;
  depth: number;
  names: Record<number, string>;
  people: MentionPerson[];
  issueKey: string;
  tab: string;
  replyAs: string;
  action: Action;
}) {
  const name = names[node.comment.authorId] ?? 'Someone';
  const mentions = people.map((person) => person.name);
  return (
    <article className={depth > 0 && depth <= MAX_VISUAL_DEPTH ? 'comment-block comment-nested' : 'comment-block'}>
      <header className="comment-head">
        <span className="avatar">{name.slice(0, 1)}</span>
        <span className="comment-name">{name}</span>
        <time className="comment-time" dateTime={node.comment.createdAt}>
          {formatWhen(node.comment.createdAt)}
        </time>
      </header>
      <div className="comment-body">
        {isHtmlBody(node.comment.body) ? (
          <WikiHtml html={node.comment.body} />
        ) : (
          <Markdown source={node.comment.body} people={people} />
        )}
      </div>
      <ReplyComposer
        action={action}
        issueKey={issueKey}
        parentId={node.comment.id}
        tab={tab}
        placeholder={`Reply as ${replyAs}`}
        mentions={mentions}
      />
      {node.replies.length > 0 && (
        <div className="comment-replies">
          {node.replies.map((reply) => (
            <CommentThread
              key={reply.comment.id}
              node={reply}
              depth={depth + 1}
              names={names}
              people={people}
              issueKey={issueKey}
              tab={tab}
              replyAs={replyAs}
              action={action}
            />
          ))}
        </div>
      )}
    </article>
  );
}
