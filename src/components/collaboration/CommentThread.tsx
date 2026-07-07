import { useState } from 'react';
import { Send } from 'lucide-react';
import { EmptyState } from '../ui/empty-state';
import { Icon } from '../icons/registry';
import { cn } from '../../lib/utils';
import type { Comment } from './types';

interface CommentThreadProps {
  comments: Comment[];
  onAdd?: (text: string) => void;
  className?: string;
}

/** Renders a mention (@name) with gold highlighting. */
function renderText(text: string) {
  return text.split(/(@[\w.-]+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-gold-light font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CommentThread({ comments, onAdd, className }: CommentThreadProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim() || !onAdd) return;
    onAdd(draft.trim());
    setDraft('');
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {comments.length === 0 ? (
          <EmptyState icon={<Icon name="messages" size={20} />} title="No comments yet" description="Start the discussion. Use @ to mention a collaborator." />
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center flex-shrink-0 text-xs font-medium text-white">
                {c.author.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-white">{c.author}</span>
                  <span className="text-xs text-slate-400 ml-2">{c.at}</span>
                </p>
                <p className="text-sm text-slate-300 mt-0.5">{renderText(c.text)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {onAdd && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a comment… use @ to mention"
            className="flex-1 rounded-xl border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <button onClick={submit} className="p-2 rounded-xl ca-gradient-gold text-navy hover:brightness-110" aria-label="Send comment">
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
