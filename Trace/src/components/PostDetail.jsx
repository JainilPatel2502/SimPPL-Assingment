import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ThumbsUp, MessageSquare, Calendar, User, Home, Link as LinkIcon } from 'lucide-react';

const formatDate = (utc) => {
  if (!utc) return '—';
  return new Date(parseFloat(utc) * 1000).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PostDetail({ post, isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && post && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 h-full w-full max-w-[600px] z-[101] flex flex-col border-l border-white/[0.07] bg-black/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <LinkIcon size={14} className="text-violet-300" />
                </div>
                <span className="text-[13px] font-medium text-white/70">Post Investigation</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/70 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

              {/* Title */}
              <h1 className="text-[16px] font-semibold text-white leading-snug">{post.title}</h1>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Score', value: post.score?.toLocaleString(), icon: ThumbsUp },
                  { label: 'Comments', value: post.num_comments?.toLocaleString(), icon: MessageSquare },
                  { label: 'Engagement', value: ((post.score || 0) + (post.num_comments || 0)).toLocaleString(), icon: null },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">{label}</p>
                    <div className="flex items-center gap-1.5">
                      {Icon && <Icon size={13} className="text-violet-400/60" />}
                      <span className="text-[15px] text-white font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Author + Subreddit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/[0.1] flex items-center justify-center">
                    <User size={14} className="text-violet-300" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-widest">Author</p>
                    <p className="text-[12px] text-violet-300 mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>u/{post.author}</p>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    <Home size={14} className="text-white/40" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-widest">Community</p>
                    <p className="text-[12px] text-white/60 mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>r/{post.subreddit}</p>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-[12px] text-white/25">
                <Calendar size={12} />
                <span>{formatDate(post.created_utc)}</span>
              </div>

              {/* Body */}
              {post.selftext && post.selftext !== '' && post.selftext !== '[removed]' && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-5">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Content</p>
                  <p className="text-[13px] text-white/55 leading-relaxed whitespace-pre-wrap font-light">{post.selftext}</p>
                </div>
              )}

              {/* Source link */}
              {post.url && (
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-lg border border-white/[0.07] bg-white/[0.03] hover:border-violet-400/30 hover:bg-white/[0.055] transition-all group"
                >
                  <div>
                    <p className="text-[12px] text-white/60 group-hover:text-white/80 transition-colors">View Source</p>
                    <p className="text-[11px] text-white/25 mt-0.5 truncate max-w-[380px]">{post.url}</p>
                  </div>
                  <ExternalLink size={14} className="text-white/25 group-hover:text-violet-300 transition-colors shrink-0" />
                </a>
              )}

              {/* Metadata tags */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
                {[`Domain: ${post.domain}`, `ID: ${post.id}`].map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/25">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
