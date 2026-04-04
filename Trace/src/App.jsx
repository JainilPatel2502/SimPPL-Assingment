import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchTimeline,
  fetchTimelineSummary,
  fetchSubreddits,
  fetchDomains,
  fetchAuthors,
  fetchNetwork,
  fetchSearch,
  fetchClusters,
} from "./lib/api";
import {
  Search,
  Users,
  Globe,
  LayoutDashboard,
  Calendar,
  RefreshCw,
  ArrowLeft,
  MessageSquare,
  X,
  PanelRightOpen,
  PanelRightClose,
  Component,
} from "lucide-react";
import TimelineChart from "./components/TimelineChart";
import BarChart from "./components/BarChart";
import RankedTable from "./components/RankedTable";
import NetworkGraph from "./components/NetworkGraph";
import TopicClusters from "./components/TopicClusters";
import PostList from "./components/PostList";
import ChatPanel from "./components/ChatPanel";

const CARD =
  "rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-2xl";

function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(
    () => window.sessionStorage.setItem(key, JSON.stringify(value)),
    [key, value],
  );
  return [value, setValue];
}

const AppCache = {
  key: null,
  timelineData: [],
  subreddits: [],
  domains: [],
  authors: [],
  networkData: { nodes: [], links: [] },
  clusterData: [],
  timelineSummary: "",
  evidencePosts: [],
  totalMatches: 0,
  postOffset: 0,
  postSortBy: "score",
  nClusters: 5,
};

function App() {
  const [query, setQuery] = useSessionState("trace_query", "");
  const [subredditQuery, setSubredditQuery] = useSessionState("trace_sub", "");
  const [authorQuery, setAuthorQuery] = useSessionState("trace_auth", "");
  const [searchInput, setSearchInput] = useSessionState(
    "trace_input",
    "epstein",
  );

  const [startDate, setStartDate] = useSessionState("trace_start", null);
  const [endDate, setEndDate] = useSessionState("trace_end", null);
  const [mode, setMode] = useSessionState("trace_mode", "topic");
  const [searchMode, setSearchMode] = useSessionState(
    "trace_search_mode",
    "semantic",
  );

  // Also track these in session state so they restore instantly before computing params key
  const [nClusters, setNClusters] = useSessionState("trace_clusters", 5);
  const [postSortBy, setPostSortBy] = useSessionState("trace_sort", "score");

  const currentParamsKey = JSON.stringify({
    query,
    subredditQuery,
    searchMode,
    authorQuery,
    startDate,
    endDate,
    mode,
    postSortBy,
    nClusters,
  });
  const isRestoring =
    AppCache.key === currentParamsKey && AppCache.key !== null;

  const [timelineData, setTimelineData] = useState(
    isRestoring ? AppCache.timelineData : [],
  );
  const [subreddits, setSubreddits] = useState(
    isRestoring ? AppCache.subreddits : [],
  );
  const [domains, setDomains] = useState(isRestoring ? AppCache.domains : []);
  const [authors, setAuthors] = useState(isRestoring ? AppCache.authors : []);
  const [networkData, setNetworkData] = useState(
    isRestoring ? AppCache.networkData : { nodes: [], links: [] },
  );
  const [clusterData, setClusterData] = useState(
    isRestoring ? AppCache.clusterData : [],
  );
  const [timelineSummary, setTimelineSummary] = useState(
    isRestoring ? AppCache.timelineSummary : "",
  );
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [evidencePosts, setEvidencePosts] = useState(
    isRestoring ? AppCache.evidencePosts : [],
  );
  const [totalMatches, setTotalMatches] = useState(
    isRestoring ? AppCache.totalMatches : 0,
  );
  const [postOffset, setPostOffset] = useState(
    isRestoring ? AppCache.postOffset : 0,
  );
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useSessionState("trace_chat_width", 340);
  const [isResizingChat, setIsResizingChat] = useState(false);

  const navigate = useNavigate();

  const currentQuery =
    mode === "topic" || mode === "cluster" ? query || null : null;
  const currentSubreddit = mode === "subreddit" ? subredditQuery || null : null;
  const currentAuthor = mode === "user" ? authorQuery || null : null;

  const loadData = async (isIncremental = false) => {
    if (!currentQuery && !currentSubreddit && !currentAuthor) {
      setTimelineData([]);
      setSubreddits([]);
      setDomains([]);
      setAuthors([]);
      setNetworkData({ nodes: [], links: [] });
      setEvidencePosts([]);
      setTotalMatches(0);
      return;
    }
    setLoading(true);
    try {
      if (!isIncremental) {
        const [timeline, subs, doms, auth, net, clusters, evidence] =
          await Promise.all([
            fetchTimeline(
              currentQuery,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
            ),
            fetchSubreddits(
              currentQuery,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
              15,
            ),
            fetchDomains(
              currentQuery,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
              15,
            ),
            fetchAuthors(
              currentQuery,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
              15,
            ),
            fetchNetwork(
              currentQuery,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
              60,
            ),
            fetchClusters(nClusters, 2000),
            fetchSearch(
              currentQuery,
              searchMode,
              currentSubreddit,
              currentAuthor,
              startDate,
              endDate,
              10,
              postSortBy,
              "desc",
              0,
            ),
          ]);
        setTimelineData(timeline);
        AppCache.timelineData = timeline;
        setSubreddits(subs);
        AppCache.subreddits = subs;
        setDomains(doms);
        AppCache.domains = doms;
        setAuthors(auth);
        AppCache.authors = auth;
        setNetworkData(net);
        AppCache.networkData = net;
        setClusterData(clusters || []);
        AppCache.clusterData = clusters || [];
        setEvidencePosts(evidence.results);
        AppCache.evidencePosts = evidence.results;
        setTotalMatches(evidence.total_matches);
        AppCache.totalMatches = evidence.total_matches;
        AppCache.postOffset = 0;
        AppCache.nClusters = nClusters;
        AppCache.postSortBy = postSortBy;
        AppCache.key = currentParamsKey;

        // Fetch AI Summary asynchronously
        setLoadingSummary(true);
        fetchTimelineSummary(
          currentQuery,
          currentSubreddit,
          currentAuthor,
          startDate,
          endDate,
        )
          .then((summaryRes) => {
            setTimelineSummary(summaryRes.summary);
            AppCache.timelineSummary = summaryRes.summary;
            setLoadingSummary(false);
          })
          .catch((err) => {
            console.error("AI Summary error", err);
            setTimelineSummary("AI Summary failed to load.");
            AppCache.timelineSummary = "AI Summary failed to load.";
            setLoadingSummary(false);
          });
      } else {
        const evidence = await fetchSearch(
          currentQuery,
          searchMode,
          currentSubreddit,
          currentAuthor,
          startDate,
          endDate,
          10,
          postSortBy,
          "desc",
          postOffset,
        );
        setEvidencePosts((prev) => {
          const updated = [...prev, ...evidence.results];
          AppCache.evidencePosts = updated;
          return updated;
        });
        setTotalMatches(evidence.total_matches);
        AppCache.totalMatches = evidence.total_matches;
        AppCache.postOffset = postOffset;
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentParamsKey = JSON.stringify({
      query,
      subredditQuery,
      authorQuery,
      searchMode,
      startDate,
      endDate,
      mode,
      postSortBy,
      nClusters,
    });
    if (AppCache.key === currentParamsKey) return;

    setPostOffset(0);
    AppCache.key = currentParamsKey;
    loadData(false);
  }, [
    query,
    subredditQuery,
    authorQuery,
    searchMode,
    startDate,
    endDate,
    mode,
    postSortBy,
    nClusters,
  ]);
  useEffect(() => {
    if (postOffset > 0 && AppCache.postOffset !== postOffset) {
      AppCache.postOffset = postOffset;
      loadData(true);
    }
  }, [postOffset]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingChat) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 1200) {
        setChatWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizingChat(false);
    };
    if (isResizingChat) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingChat, setChatWidth]);

  const handleLoadMore = () => setPostOffset((prev) => prev + 10);

  const handleSearch = (e) => {
    e.preventDefault();
    AppCache.key = null; // force reload
    if (mode === "subreddit") {
      setSubredditQuery(searchInput);
      setQuery("");
      setAuthorQuery("");
    } else if (mode === "user") {
      setAuthorQuery(searchInput);
      setQuery("");
      setSubredditQuery("");
    } else {
      setQuery(searchInput);
      setSubredditQuery("");
      setAuthorQuery("");
    }
  };

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleSubredditClick = (name) => {
    setMode("subreddit");
    setSearchInput(name);
    setSubredditQuery(name);
    setQuery("");
    setAuthorQuery("");
  };
  const handleAuthorClick = (name) => {
    setMode("user");
    setSearchInput(name);
    setAuthorQuery(name);
    setQuery("");
    setSubredditQuery("");
  };

  const switchMode = (m) => {
    setMode(m);
    if (m === "topic" || m === "cluster") setSearchInput(query || "epstein");
    if (m === "subreddit") setSearchInput(subredditQuery || "conspiracy");
    if (m === "user") setSearchInput(authorQuery || "");
  };

  const modeLabels = {
    topic: {
      header: "Narrative Intelligence",
      hint: "Tracking Epstein discourse across Reddit",
    },
    subreddit: {
      header: `r/${subredditQuery || "…"}`,
      hint: "Community deep dive",
    },
    user: { header: `u/${authorQuery || "…"}`, hint: "Actor profile" },
    cluster: {
      header: "Semantic Clustering",
      hint: "3D UMAP text embeddings dynamically clustered",
    },
  };
  const lbl = modeLabels[mode];

  const navItems = [
    { key: "topic", Icon: LayoutDashboard, label: "Topic Analysis" },
    { key: "subreddit", Icon: Globe, label: "Subreddit Mode" },
    { key: "user", Icon: Users, label: "Actor Mode" },
    { key: "cluster", Icon: Component, label: "Semantic Clusters" },
  ];

  return (
    <div
      className="flex h-screen bg-black text-white overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(88,28,235,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── LEFT SIDEBAR ── */}
      <div className="relative z-10 w-56 shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl">
        <div className="px-5 pt-7 pb-5">
          <h1 className="text-[15px] font-semibold tracking-[0.15em] text-white uppercase">
            TRACE
          </h1>
          <p className="text-[10px] tracking-widest text-white/25 mt-0.5 uppercase">
            Narrative Intelligence
          </p>
        </div>
        <div className="h-px bg-white/[0.06] mx-5" />
        <nav className="flex-1 py-5 px-3 flex flex-col gap-0.5">
          {navItems.map(({ key, Icon: ItemIcon, label }) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 text-left w-full ${
                mode === key
                  ? "bg-white/[0.07] text-white border-l-2 border-violet-400 rounded-l-none"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <ItemIcon
                size={15}
                className={mode === key ? "text-violet-400" : "text-white/30"}
              />
              {label}
            </button>
          ))}
        </nav>
        {(mode === "subreddit" || mode === "user") && (
          <button
            onClick={() => switchMode("topic")}
            className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all border border-white/[0.05]"
          >
            <ArrowLeft size={12} /> Back to Topic
          </button>
        )}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/20 tracking-wider">
            2026 · Epstein Case
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
        {/* Header */}
        <header className="h-[60px] border-b border-white/[0.06] flex items-center justify-between px-6 bg-black/70 backdrop-blur-2xl shrink-0">
          <div className="flex items-center gap-5">
            <div>
              <p className="text-[13px] font-semibold text-white leading-none">
                {lbl.header}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">{lbl.hint}</p>
            </div>
            <div className="h-4 w-px bg-white/[0.08]" />
            <form
              onSubmit={handleSearch}
              className="relative flex items-center gap-2"
            >
              <div className="relative flex-1 flex items-center gap-3">
                <div className="relative w-[500px]">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                    size={15}
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search narratives, communities, or keywords…"
                    className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-xl py-2.5 pl-10 pr-4 text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.06] transition-all"
                  />
                </div>

                {/* Search Mode Toggle */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] shrink-0">
                  <span
                    className={`text-[11px] font-medium transition-colors ${searchMode === "keyword" ? "text-violet-400" : "text-white/30"}`}
                  >
                    Keyword
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSearchMode((prev) =>
                        prev === "semantic" ? "keyword" : "semantic",
                      )
                    }
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                    style={{
                      backgroundColor:
                        searchMode === "semantic"
                          ? "rgba(139, 92, 246, 0.4)"
                          : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${searchMode === "semantic" ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span
                    className={`text-[11px] font-medium transition-colors ${searchMode === "semantic" ? "text-violet-400" : "text-white/30"}`}
                  >
                    Semantic
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-[13px] px-5 py-2.5 rounded-xl transition-colors border border-violet-500 hover:border-violet-400 shrink-0 ml-2"
              >
                Search
              </button>
            </form>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 text-[11px] ${loading ? "text-white/40" : "text-white/30"}`}
            >
              {loading ? (
                <>
                  <RefreshCw size={11} className="animate-spin" />
                  <span>Loading</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                </>
              )}
            </div>
            <div className="h-4 w-px bg-white/[0.08]" />
            <button
              onClick={() => setChatOpen((o) => !o)}
              title="Toggle AI Chat"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                chatOpen
                  ? "bg-violet-500/10 border-violet-400/30 text-violet-300"
                  : "bg-white/[0.04] border-white/[0.07] text-white/35 hover:text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              <MessageSquare size={13} />
              <span>Explore with AI</span>
            </button>
          </div>
        </header>

        {/* Dashboard / Clusters */}
        <main
          className={`flex-1 overflow-y-auto ${mode === "cluster" ? "p-0" : "p-5"}`}
        >
          {mode === "cluster" ? (
            <motion.div
              className="flex flex-col h-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="p-5 flex justify-between items-end border-b border-white/[0.04] bg-white/[0.02]">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5">
                    Semantic Topic Clustering
                  </p>
                  <p className="text-[10px] text-white/20">
                    3D UMAP text embeddings dynamically clustered via KMeans
                  </p>
                </div>
              </div>
              <div className="flex-1 relative bg-black">
                <TopicClusters
                  data={clusterData}
                  nClusters={nClusters}
                  onSliderChange={setNClusters}
                  onNodeClick={(post) => navigate("/post", { state: { post } })}
                />
              </div>
            </motion.div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-5">
              {/* Row 1: Timeline */}
              <div className="grid grid-cols-1 gap-5">
                <motion.div
                  className={`${CARD} p-5`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-[11px] text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={12} className="text-violet-400/70" />
                    {mode === "user"
                      ? `Timeline — u/${authorQuery}`
                      : "Narrative Velocity"}
                  </p>
                  <div className="h-[260px] w-full min-w-0">
                    <TimelineChart
                      data={timelineData}
                      onDateChange={handleDateChange}
                    />
                  </div>

                  {/* Dynamically Generated Summary Box */}
                  {timelineData && timelineData.length > 0 && (
                    <div className="mt-4 p-3 bg-violet-500/5 border border-violet-500/10 rounded-lg text-white/60 text-[12px] leading-relaxed flex items-start gap-2">
                      <MessageSquare
                        size={14}
                        className="text-violet-400/50 mt-0.5 shrink-0"
                      />
                      <p className="flex-1">
                        <strong className="text-white/80">AI Insight: </strong>
                        {loadingSummary ? (
                          <span className="animate-pulse text-white/40 ml-1">
                            Analyzing timeline events...
                          </span>
                        ) : (
                          <span>{timelineSummary}</span>
                        )}
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Row 2: 2 charts */}
              <div className="grid grid-cols-2 gap-5">
                <motion.div
                  className={`${CARD} p-5`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                >
                  <p className="text-[11px] text-white/30 uppercase tracking-widest mb-4">
                    {mode === "user"
                      ? "Target Communities"
                      : mode === "subreddit"
                        ? "Top Domains"
                        : "Community Distribution"}
                  </p>
                  <div className="h-[220px] w-full min-w-0">
                    {mode === "subreddit" ? (
                      <BarChart
                        data={domains}
                        dataKey="count"
                        nameKey="domain"
                      />
                    ) : (
                      <BarChart
                        data={subreddits}
                        dataKey="count"
                        nameKey="subreddit"
                        onBarClick={(d) => handleSubredditClick(d.subreddit)}
                      />
                    )}
                  </div>
                </motion.div>

                <motion.div
                  className={`${CARD} overflow-hidden`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.16 }}
                >
                  <div className="p-5 pb-3">
                    <p className="text-[11px] text-white/30 uppercase tracking-widest">
                      {mode === "user" ? "Co-Active Actors" : "Top Amplifiers"}
                    </p>
                    {mode !== "user" && (
                      <p className="text-[10px] text-white/20 mt-1">
                        Click to profile →
                      </p>
                    )}
                  </div>
                  <div className="h-[200px] overflow-auto">
                    <RankedTable
                      columns={[
                        { key: "author", label: "Actor" },
                        { key: "count", label: "Posts" },
                      ]}
                      data={authors}
                      onRowClick={(row) => handleAuthorClick(row.author)}
                    />
                  </div>
                </motion.div>
              </div>

              {/* Row 3: Network Graph (Full Width) */}
              <motion.div
                className={`${CARD} p-5 flex flex-col`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
              >
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5">
                      {mode === "user"
                        ? "Community Footprint"
                        : "Information Ecosystem"}
                    </p>
                    <p className="text-[10px] text-white/20">
                      Authors · Subreddits network (Sized by Centrality)
                    </p>
                  </div>
                  <div className="text-[10px] text-white/30 bg-white/[0.03] px-2 py-1 rounded">
                    Interactive Map
                  </div>
                </div>
                <div className="w-full h-[400px] relative rounded-lg overflow-hidden bg-black/30 border border-white/[0.04]">
                  {networkData.nodes.length > 0 ? (
                    <NetworkGraph
                      graphData={networkData}
                      onNodeClick={(node) => {
                        if (node.group === 1) {
                          handleAuthorClick(node.name);
                        } else if (node.group === 2) {
                          const subName = node.name.startsWith("r/")
                            ? node.name.slice(2)
                            : node.name;
                          handleSubredditClick(subName);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-white/15">
                      No data
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Evidence */}
              <PostList
                title={
                  mode === "user"
                    ? "Posts by This Actor"
                    : mode === "subreddit"
                      ? `Top Posts in r/${subredditQuery}`
                      : "Evidence Layer"
                }
                posts={evidencePosts}
                totalPosts={totalMatches}
                sortBy={postSortBy}
                onSortChange={setPostSortBy}
                onPostClick={(post) => navigate("/post", { state: { post } })}
                onAuthorClick={handleAuthorClick}
                onSubredditClick={handleSubredditClick}
                onLoadMore={handleLoadMore}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── RIGHT CHAT PANEL ── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: chatWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={
              isResizingChat
                ? { duration: 0 }
                : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
            }
            className="relative z-10 shrink-0 border-l border-white/[0.06] bg-black/80 backdrop-blur-2xl flex flex-col overflow-hidden"
            style={{ minWidth: 0 }}
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 transition-colors ${
                isResizingChat ? "bg-violet-500/80" : "hover:bg-violet-500/50"
              }`}
              onMouseDown={() => setIsResizingChat(true)}
            />
            <ChatPanel onClose={() => setChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
