'use client';

import { useState } from 'react';
import { toggleReactionAction } from '@/app/actions';
import { QUICK_REACTIONS, REACTION_EMOJIS } from '@/lib/emojis';

type Reaction = { emoji: string; count: number; mine: boolean; users: string[] };

export function Reactions({
  issueKey,
  kind,
  targetId,
  reactions,
}: {
  issueKey: string;
  kind: 'issue' | 'comment';
  targetId: number;
  reactions: Reaction[];
}) {
  const [more, setMore] = useState(false);
  const given = reactions.filter((item) => item.count > 0);

  return (
    <div className="reactions">
      {given.map((reaction) => (
        <form key={reaction.emoji} action={toggleReactionAction}>
          <input type="hidden" name="key" value={issueKey} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="target" value={String(targetId)} />
          <input type="hidden" name="emoji" value={reaction.emoji} />
          <button
            type="submit"
            className={reaction.mine ? 'reaction on' : 'reaction'}
            title={reaction.users.join(', ')}
            aria-pressed={reaction.mine}
            aria-label={`${reaction.emoji} ${reaction.count}`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        </form>
      ))}
      <div className="reaction-pick" aria-hidden={false}>
        {QUICK_REACTIONS.map((emoji) => (
          <form key={emoji} action={toggleReactionAction}>
            <input type="hidden" name="key" value={issueKey} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="target" value={String(targetId)} />
            <input type="hidden" name="emoji" value={emoji} />
            <button type="submit" className="reaction-quiet" aria-label={`React with ${emoji}`} title={`React with ${emoji}`}>
              <span aria-hidden="true">{emoji}</span>
            </button>
          </form>
        ))}
        <div className="reaction-add">
          <button
            type="button"
            className="reaction-more"
            aria-label="More reactions"
            aria-expanded={more}
            title="More reactions"
            onClick={() => setMore((value) => !value)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" x2="9.01" y1="10" y2="10" />
              <line x1="15" x2="15.01" y1="10" y2="10" />
            </svg>
          </button>
          {more ? (
            <div className="reaction-pop" role="listbox" aria-label="Pick a reaction">
              {REACTION_EMOJIS.map((emoji) => (
                <form key={emoji} action={toggleReactionAction}>
                  <input type="hidden" name="key" value={issueKey} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="target" value={String(targetId)} />
                  <input type="hidden" name="emoji" value={emoji} />
                  <button type="submit" aria-label={`React with ${emoji}`}>
                    {emoji}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
