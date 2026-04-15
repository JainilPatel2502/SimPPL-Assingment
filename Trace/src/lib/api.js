import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api/topic",
});

// Format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return undefined;
  return new Date(date).toISOString().split("T")[0];
};

export const fetchSearch = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
  limit = 50,
  sortBy = "score",
  order = "desc",
  offset = 0,
) => {
  const { data } = await api.get("/search", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      limit,
      sort_by: sortBy,
      order,
      offset,
    },
  });
  return data;
};

export const fetchTimeline = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
) => {
  const { data } = await api.get("/timeline", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    },
  });
  return data;
};

export const fetchTimelineSummary = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
) => {
  const { data } = await api.get("/timeline/summary", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    },
  });
  return data;
};

export const fetchSubreddits = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
  limit = 20,
) => {
  const { data } = await api.get("/subreddits", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      limit,
    },
  });
  return data;
};

export const fetchDomains = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
  limit = 20,
) => {
  const { data } = await api.get("/domains", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      limit,
    },
  });
  return data;
};

export const fetchAuthors = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
  limit = 20,
) => {
  const { data } = await api.get("/authors", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      limit,
    },
  });
  return data;
};

export const fetchNetwork = async (
  query = "",
  searchMode = "semantic",
  subreddit = null,
  author = null,
  startDate = null,
  endDate = null,
  limitNodes = 100,
) => {
  const { data } = await api.get("/network", {
    params: {
      q: query,
      search_mode: searchMode,
      subreddit,
      author,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      limit_nodes: limitNodes,
    },
  });
  return data;
};

export const fetchClusters = async (nClusters = 5, limit = 2000) => {
  const { data } = await api.get("/clusters", {
    params: { n_clusters: nClusters, limit },
  });
  return data;
};

const rootApi = axios.create({ baseURL: "http://localhost:8000" });

export const sendChatMessage = async (message, history = []) => {
  const { data } = await rootApi.post("/api/chat", { message, history });
  return data; // { answer, code, raw_result }
};

export const fetchPostAnalysis = async (title, content) => {
  const { data } = await rootApi.post("/api/post/analyze", { title, content });
  return data;
};
