const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const NEWS_FEEDS = [
  { site: "The Hacker News", url: "https://thehackernews.com/feeds/posts/default?alt=rss" },
  { site: "Dark Reading", url: "https://www.darkreading.com/rss.xml" },
  { site: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
  { site: "Threatpost", url: "https://threatpost.com/feed/" },
  { site: "WeLiveSecurity", url: "https://www.welivesecurity.com/en/feed/" },
  { site: "CyberScoop", url: "https://www.cyberscoop.com/feed/" },
  { site: "The Register", url: "https://www.theregister.com/security/headlines.atom" },
  { site: "Help Net Security", url: "https://www.helpnetsecurity.com/feed/" },
  { site: "Schneier on Security", url: "https://www.schneier.com/feed/atom/" },
  { site: "IT Security Guru", url: "https://www.itsecurityguru.org/feed/" }
];

const IOC_FEEDS = [
  {
    source: "stamparm/ipsum",
    type: "ip",
    url: "https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt",
    parse: (text) => text.split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .slice(0, 200)
      .map((line) => ({ type: "IP", value: line.split("\t")[0], source: "ipsum" }))
  },
  {
    source: "Phishing.Database",
    type: "url",
    url: "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-links-ACTIVE.txt",
    parse: (text) => text.split("\n")
      .filter((line) => line.startsWith("http"))
      .slice(0, 200)
      .map((line) => ({ type: "URL", value: line.trim(), source: "phishing-db" }))
  },
  {
    source: "hagezi domains",
    type: "domain",
    url: "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/multi.txt",
    parse: (text) => text.split("\n")
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
      .slice(0, 200)
      .map((line) => ({ type: "Domain", value: line.trim(), source: "hagezi" }))
  }
];

const BUCKETS = [
  { name: "Phishing / Malicious Attachments", patterns: ["phish", "malspam", "attachment", "email"] },
  { name: "Public-Facing Exploits", patterns: ["vulnerability", "exploit", "zero-day", "vpn", "firewall"] },
  { name: "Credential Theft & Abuse", patterns: ["credential", "token", "session", "mfa", "account"] },
  { name: "Ransomware Activity", patterns: ["ransomware", "encrypt", "extortion"] },
  { name: "C2 / Beaconing", patterns: ["c2", "command-and-control", "beacon"] },
  { name: "Data Exfiltration", patterns: ["exfil", "data theft", "leak", "steal data"] },
  { name: "Defense Evasion / BYOVD", patterns: ["driver", "byovd", "edr", "defense evasion"] },
  { name: "Lateral Movement", patterns: ["lateral", "psexec", "wmic", "remote"] },
  { name: "Supply Chain", patterns: ["supply chain", "package", "dependency", "repo"] },
  { name: "Cloud / SaaS Abuse", patterns: ["cloud", "s3", "azure", "oauth", "saas"] }
];

const statusEl = document.getElementById("status");
const lastUpdateEl = document.getElementById("lastUpdate");
const nextDueEl = document.getElementById("nextDue");
const newsListEl = document.getElementById("newsList");
const bucketListEl = document.getElementById("bucketList");
const iocTableBody = document.getElementById("iocTableBody");
const checkBtn = document.getElementById("checkBtn");
const forceBtn = document.getElementById("forceBtn");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function formatDate(ts) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}

function getStorage() {
  return {
    lastUpdate: Number(localStorage.getItem("lastUpdate") || 0),
    iocs: JSON.parse(localStorage.getItem("iocs") || "[]"),
    news: JSON.parse(localStorage.getItem("news") || "[]")
  };
}

function setStorage(data) {
  if (data.lastUpdate !== undefined) localStorage.setItem("lastUpdate", String(data.lastUpdate));
  if (data.iocs !== undefined) localStorage.setItem("iocs", JSON.stringify(data.iocs));
  if (data.news !== undefined) localStorage.setItem("news", JSON.stringify(data.news));
}

function isDue(lastUpdate) {
  return !lastUpdate || Date.now() - lastUpdate >= THREE_DAYS_MS;
}

function getNextDue(lastUpdate) {
  if (!lastUpdate) return "Now";
  const due = lastUpdate + THREE_DAYS_MS;
  if (Date.now() >= due) return "Now";
  return new Date(due).toLocaleString();
}

async function fetchViaRss2Json(site, feedUrl) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=3`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`${site} RSS bridge failed`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    site,
    title: item.title,
    link: item.link,
    date: new Date(item.pubDate || item.published || Date.now()).toISOString()
  }));
}

function withinLast3Days(isoDate) {
  return Date.now() - new Date(isoDate).getTime() <= THREE_DAYS_MS;
}

async function fetchNews() {
  const all = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const entries = await fetchViaRss2Json(feed.site, feed.url);
      all.push(...entries.filter((e) => withinLast3Days(e.date)));
    } catch (_e) {
      all.push({
        site: feed.site,
        title: "Could not fetch in-browser for this source (CORS/API limit).",
        link: "",
        date: new Date().toISOString(),
        warning: true
      });
    }
  }
  return all.slice(0, 30);
}

function classifyHeadline(title) {
  const t = (title || "").toLowerCase();
  const matched = BUCKETS.filter((b) => b.patterns.some((p) => t.includes(p)));
  return matched.length ? matched.map((m) => m.name) : ["General Threat Activity"];
}

function dedupeBuckets(news) {
  const bucketMap = new Map();
  news.forEach((n) => {
    classifyHeadline(n.title).forEach((bucket) => {
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket).push(n);
    });
  });
  return [...bucketMap.entries()].map(([name, items]) => ({ name, count: items.length, sites: [...new Set(items.map((i) => i.site))] }));
}

async function fetchIocs() {
  const out = [];
  for (const feed of IOC_FEEDS) {
    try {
      const res = await fetch(feed.url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      out.push(...feed.parse(text));
    } catch (_e) {
      // continue with others
    }
  }
  // unique + capped
  const seen = new Set();
  return out.filter((ioc) => {
    const k = `${ioc.type}|${ioc.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 120);
}

function scoreRelevance(ioc, buckets) {
  const joined = buckets.map((b) => b.name.toLowerCase()).join(" ");
  if (ioc.type === "URL" && joined.includes("phish")) return "High (Phishing overlap)";
  if (ioc.type === "IP" && joined.includes("c2")) return "High (C2 overlap)";
  if (ioc.type === "Domain" && joined.includes("exfil")) return "Medium (Exfil overlap)";
  return "Medium";
}

function renderNews(news) {
  newsListEl.innerHTML = "";
  if (!news.length) {
    newsListEl.innerHTML = `<div class="item">No headlines found in the last 3 days.</div>`;
    return;
  }
  news.forEach((n) => {
    const div = document.createElement("div");
    div.className = "item";
    const title = n.link ? `<a href="${n.link}" target="_blank" rel="noopener noreferrer">${n.title}</a>` : n.title;
    div.innerHTML = `<span class="badge">${n.site}</span>${title}`;
    newsListEl.appendChild(div);
  });
}

function renderBuckets(buckets) {
  bucketListEl.innerHTML = "";
  if (!buckets.length) {
    bucketListEl.innerHTML = `<div class="item">No threat buckets identified yet.</div>`;
    return;
  }
  buckets.sort((a, b) => b.count - a.count).forEach((b) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${b.name}</strong> — ${b.count} related stories <br><span class="muted">Sources: ${b.sites.join(", ")}</span>`;
    bucketListEl.appendChild(div);
  });
}

function renderIocs(iocs, buckets) {
  iocTableBody.innerHTML = "";
  if (!iocs.length) {
    iocTableBody.innerHTML = `<tr><td colspan="4">No IOCs available yet.</td></tr>`;
    return;
  }
  iocs.forEach((ioc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ioc.type}</td>
      <td><code>${ioc.value}</code></td>
      <td>${ioc.source}</td>
      <td>${scoreRelevance(ioc, buckets)}</td>
    `;
    iocTableBody.appendChild(tr);
  });
}

async function updateAll(force = false) {
  const state = getStorage();
  if (!force && !isDue(state.lastUpdate)) {
    setStatus("Not due yet (refresh interval is 3 days). Showing cached results.");
    lastUpdateEl.textContent = formatDate(state.lastUpdate);
    nextDueEl.textContent = getNextDue(state.lastUpdate);
    renderNews(state.news);
    renderBuckets(dedupeBuckets(state.news));
    renderIocs(state.iocs, dedupeBuckets(state.news));
    return;
  }

  setStatus("Updating headlines and IOCs...");
  const news = await fetchNews();
  const iocs = await fetchIocs();
  const now = Date.now();

  setStorage({ news, iocs, lastUpdate: now });
  const buckets = dedupeBuckets(news);

  renderNews(news);
  renderBuckets(buckets);
  renderIocs(iocs, buckets);

  lastUpdateEl.textContent = formatDate(now);
  nextDueEl.textContent = getNextDue(now);
  setStatus(`Update complete. ${news.length} headlines and ${iocs.length} IOCs loaded.`);
}

function initialize() {
  const state = getStorage();
  lastUpdateEl.textContent = formatDate(state.lastUpdate);
  nextDueEl.textContent = getNextDue(state.lastUpdate);

  if (state.news.length || state.iocs.length) {
    const buckets = dedupeBuckets(state.news);
    renderNews(state.news);
    renderBuckets(buckets);
    renderIocs(state.iocs, buckets);
  }

  checkBtn.addEventListener("click", () => updateAll(false));
  forceBtn.addEventListener("click", () => updateAll(true));
}

initialize();
