import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  Home,
  Link as LinkIcon,
  Sparkles,
  FlaskConical,
  Tag,
  Activity,
} from "lucide-react";
import { fetchPostAnalysis } from "../lib/api";

const CARD =
  "rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl";

const formatDate = (utc) => {
  if (!utc) return "—";
  return new Date(parseFloat(utc) * 1000).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StatCard({ label, value, icon: Icon, color = "text-violet-300" }) {
  return (
    <div className={`${CARD} px-5 py-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-white/25">
        {Icon && <Icon size={13} className={color} />}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <span
        className="text-2xl font-semibold text-white"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {value}
      </span>
    </div>
  );
}

function NlpPlaceholder({ icon: Icon, title, description }) {
  return (
    <div className={`${CARD} p-6 flex flex-col gap-3`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/15 flex items-center justify-center">
          <Icon size={15} className="text-violet-300/70" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-white/70">{title}</p>
          <p className="text-[11px] text-white/25">{description}</p>
        </div>
      </div>
      <div className="h-px bg-white/[0.05]" />
      <div className="flex flex-col gap-2">
        {[80, 55, 70, 40].map((w, i) => (
          <div
            key={i}
            className="h-2 rounded-full bg-white/[0.06]"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <p className="text-[10px] text-white/20 italic">
        NLP analysis coming soon
      </p>
    </div>
  );
}

export default function PostDetailPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const post = state?.post;

  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    if (post) {
      const getAnalysis = async () => {
        try {
          const data = await fetchPostAnalysis(
            post.title || "",
            post.selftext || "",
          );
          setAnalysisData(data);
        } catch (err) {
          console.error("Failed to analyze post", err);
        } finally {
          setIsAnalyzing(false);
        }
      };
      getAnalysis();
    }
  }, [post]);

  if (!post) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="text-center">
          <p className="text-white/30 mb-4">No post data found.</p>
          <button
            onClick={() => navigate("/")}
            className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(88,28,235,0.09) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 h-14 border-b border-white/[0.06] bg-black/80 backdrop-blur-2xl flex items-center px-6 gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[12px] text-white/40 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <LinkIcon size={13} className="text-violet-400/60" />
          <span className="text-[12px] text-white/40">Post Investigation</span>
        </div>
      </header>

      {/* Page body */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[22px] font-semibold text-white leading-snug"
        >
          {post.title}
        </motion.h1>

        {/* Meta row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="flex flex-wrap items-center gap-3"
        >
          <div className="flex items-center gap-1.5 text-[12px] text-violet-300/80 bg-violet-500/[0.08] border border-violet-400/[0.15] px-3 py-1 rounded-md">
            <User size={11} /> u/{post.author}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-white/45 bg-white/[0.04] border border-white/[0.07] px-3 py-1 rounded-md">
            <Home size={11} /> r/{post.subreddit}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-white/30">
            <Calendar size={11} />
            <span>{formatDate(post.created_utc)}</span>
          </div>
          {post.domain && !post.domain.startsWith("self.") && (
            <span className="text-[11px] text-white/25 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded">
              {post.domain}
            </span>
          )}
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          className="grid grid-cols-3 gap-4"
        >
          <StatCard
            label="Score"
            value={post.score?.toLocaleString() ?? "—"}
            icon={ThumbsUp}
            color="text-violet-400"
          />
          <StatCard
            label="Comments"
            value={post.num_comments?.toLocaleString() ?? "—"}
            icon={MessageSquare}
            color="text-white/40"
          />
          <StatCard
            label="Engagement"
            value={(
              (post.score || 0) + (post.num_comments || 0)
            ).toLocaleString()}
            icon={Activity}
            color="text-emerald-400/70"
          />
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left: post content + source */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Post body */}
            {post.selftext &&
              post.selftext !== "" &&
              post.selftext !== "[removed]" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.11 }}
                  className={`${CARD} p-6`}
                >
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">
                    Post Content
                  </p>
                  <p className="text-[14px] text-white/60 leading-relaxed whitespace-pre-wrap font-light">
                    {post.selftext}
                  </p>
                </motion.div>
              )}

            {/* Source link */}
            {post.url && (
              <motion.a
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.14 }}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CARD} p-5 flex items-center justify-between group hover:border-violet-400/30 hover:bg-white/[0.055] transition-all`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-white/60 group-hover:text-white/85 transition-colors font-medium">
                    View Original Source
                  </p>
                  <p className="text-[11px] text-white/25 mt-1 truncate">
                    {post.url}
                  </p>
                </div>
                <ExternalLink
                  size={16}
                  className="text-white/20 group-hover:text-violet-300 transition-colors shrink-0 ml-4"
                />
              </motion.a>
            )}

            {/* NLP placeholders & real data */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.17 }}
            >
              <p className="text-[11px] text-white/25 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles size={11} className="text-violet-400/50" /> NLP
                Analysis
              </p>

              {isAnalyzing ? (
                <div className="flex flex-col gap-4">
                  <NlpPlaceholder
                    icon={Activity}
                    title="Sentiment Analysis"
                    description="Analyzing tone..."
                  />
                  <NlpPlaceholder
                    icon={Tag}
                    title="Named Entity Recognition"
                    description="Extracting entities..."
                  />
                  <NlpPlaceholder
                    icon={FlaskConical}
                    title="Narrative Classification"
                    description="Classifying narrative..."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className={`${CARD} p-6 flex flex-col gap-3`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/15 flex items-center justify-center">
                        <Activity size={15} className="text-violet-300/70" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-white/70">
                          Sentiment Analysis
                        </p>
                        <p className="text-[11px] text-white/25">
                          Positive / Negative / Neutral scoring
                        </p>
                      </div>
                    </div>
                    <div className="h-px bg-white/[0.05]" />
                    <p className="text-[13px] text-white/80 font-medium">
                      {analysisData?.sentiment || "Unavailable"}
                    </p>
                  </div>

                  <div className={`${CARD} p-6 flex flex-col gap-3`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/15 flex items-center justify-center">
                        <Tag size={15} className="text-violet-300/70" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-white/70">
                          Named Entity Recognition
                        </p>
                        <p className="text-[11px] text-white/25">
                          People, organisations, locations mentioned
                        </p>
                      </div>
                    </div>
                    <div className="h-px bg-white/[0.05]" />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {analysisData?.entities?.length > 0 ? (
                        analysisData.entities.map((ent, idx) => (
                          <span
                            key={idx}
                            className="bg-white/5 border border-white/10 px-2 py-1 rounded text-[11px] text-white/70"
                          >
                            {ent}
                          </span>
                        ))
                      ) : (
                        <p className="text-[12px] text-white/40">
                          No significant entities found.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`${CARD} p-6 flex flex-col gap-3`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/15 flex items-center justify-center">
                        <FlaskConical
                          size={15}
                          className="text-violet-300/70"
                        />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-white/70">
                          Narrative Classification
                        </p>
                        <p className="text-[11px] text-white/25">
                          Which narrative cluster this post belongs to
                        </p>
                      </div>
                    </div>
                    <div className="h-px bg-white/[0.05]" />
                    <p className="text-[13px] text-white/80 leading-relaxed">
                      {analysisData?.narrative_classification || "Unavailable"}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: metadata panel */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.13 }}
            className="flex flex-col gap-4"
          >
            <div className={`${CARD} p-5 flex flex-col gap-4`}>
              <p className="text-[10px] text-white/25 uppercase tracking-widest">
                Post Metadata
              </p>
              <div className="h-px bg-white/[0.05]" />
              {[
                { label: "ID", value: post.id },
                { label: "Domain", value: post.domain || "—" },
                { label: "Type", value: post.post_type || "link" },
                { label: "Subreddit", value: `r/${post.subreddit}` },
                { label: "Author", value: `u/${post.author}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-white/20 uppercase tracking-widest">
                    {label}
                  </span>
                  <span
                    className="text-[12px] text-white/55 truncate"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {post.permalink && (
              <a
                href={`https://reddit.com${post.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CARD} px-4 py-3 flex items-center justify-between text-[12px] text-white/35 hover:text-violet-300 hover:border-violet-400/25 transition-all group`}
              >
                <span>View on Reddit</span>
                <ExternalLink
                  size={13}
                  className="group-hover:text-violet-300 transition-colors"
                />
              </a>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
