import { motion } from 'framer-motion';
import { Calendar, MessageSquare, ThumbsUp, ExternalLink, User, Home } from 'lucide-react';

const CARD = 'rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl';
const SORT_KEYS = ['score', 'num_comments', 'datetime', 'engagement_score'];

const formatDate = (utc) => {
  if (!utc) return '—';
  return new Date(parseFloat(utc) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PostList({ posts, totalPosts, onPostClick, onAuthorClick, onSubredditClick, title, sortBy, onSortChange, onLoadMore }) {
  if (!posts || posts.length === 0) {
    return (
      <div className={`${CARD} p-8 text-center mt-4`}>
        <p className="text-white/20 text-sm">No posts found for current filters</p>
      </div>
    );
  }

  const hasMore = posts.length < (totalPosts || 0);
  const sortLabel = (k) => ({ score: 'Score', num_comments: 'Comments', datetime: 'Date', engagement_score: 'Engagement' }[k] || k);

  return (
    <div className="mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-[2px] h-5 rounded-full bg-violet-400/60" />
          <h2 className="text-[13px] font-semibold text-white/80">{title}</h2>
          <span className="text-[11px] text-white/20 font-mono-data">{totalPosts?.toLocaleString()} posts</span>
        </div>
        <div className="flex gap-1.5">
          {SORT_KEYS.map(k => (
            <button key={k} onClick={() => onSortChange(k)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                sortBy === k
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'bg-white/[0.04] text-white/30 border-white/[0.06] hover:text-white/50 hover:bg-white/[0.06]'
              }`}
            >
              {sortLabel(k)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-2">
        {posts.map((post, idx) => (
          <motion.div
            key={post.id || idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: idx * 0.03 }}
            onClick={() => onPostClick(post)}
            className={`group relative ${CARD} px-5 py-4 cursor-pointer hover:bg-white/[0.055] hover:border-white/[0.13] transition-all duration-150 border-l-2 border-l-transparent hover:border-l-violet-400/50`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[13px] text-white/70 group-hover:text-white/95 font-medium leading-snug line-clamp-2 transition-colors flex-1">
                {post.title}
              </h3>
              <div className="flex items-center gap-3 shrink-0 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <ThumbsUp size={12} className="text-white/20" />
                  <span className="text-[11px] text-white/30" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{post.score?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={12} className="text-white/20" />
                  <span className="text-[11px] text-white/30" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{post.num_comments?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button onClick={e => { e.stopPropagation(); onAuthorClick(post.author); }}
                className="flex items-center gap-1 text-[11px] text-violet-300/70 hover:text-violet-200 bg-violet-500/[0.08] px-2 py-0.5 rounded-md transition-colors">
                <User size={10} /> u/{post.author}
              </button>
              <button onClick={e => { e.stopPropagation(); onSubredditClick(post.subreddit); }}
                className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 bg-white/[0.05] px-2 py-0.5 rounded-md transition-colors">
                <Home size={10} /> r/{post.subreddit}
              </button>
              <div className="flex items-center gap-1 text-[11px] text-white/20 ml-auto">
                <Calendar size={10} />
                <span>{formatDate(post.created_utc)}</span>
              </div>
              {post.domain && !post.domain.startsWith('self.') && (
                <div className="flex items-center gap-1 text-[11px] text-white/20">
                  <span className="truncate max-w-[100px]">{post.domain}</span>
                  <ExternalLink size={10} />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button onClick={e => { e.stopPropagation(); onLoadMore(); }}
            className="px-6 py-2 text-[12px] text-white/35 border border-white/[0.07] rounded-lg bg-white/[0.03] hover:bg-white/[0.07] hover:text-white/60 transition-all">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
