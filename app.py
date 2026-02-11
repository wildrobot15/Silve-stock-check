from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Iterable
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

HOST = "0.0.0.0"
PORT = 8000

FEEDS = {
    "CISA Alerts": "https://www.cisa.gov/news-events/cybersecurity-advisories.xml",
    "BleepingComputer": "https://www.bleepingcomputer.com/feed/",
    "The Hacker News": "https://thehackernews.com/feeds/posts/default",
    "Krebs on Security": "https://krebsonsecurity.com/feed/",
    "SANS Internet Storm Center": "https://isc.sans.edu/rssfeed.xml",
}

PRIORITY_TERMS = [
    "zero-day", "exploit", "ransomware", "apt", "cve", "siem", "edr", "xdr",
    "detection", "threat actor", "ioc", "vulnerability", "supply chain", "data breach",
]

STYLE = """
:root{color-scheme:dark;--bg:#0f172a;--panel:#111827;--card:#1f2937;--txt:#e5e7eb;--muted:#9ca3af;--accent:#22d3ee;--high:#ef4444}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Roboto,sans-serif;background:linear-gradient(180deg,#0b1021,var(--bg));color:var(--txt)}
.container{max-width:1000px;margin:0 auto;padding:2rem 1rem 3rem}h1{margin-bottom:.3rem}.sub{color:var(--muted);margin-top:0}
.panel{background:var(--panel);border:1px solid #374151;border-radius:12px;padding:1rem;margin:1.25rem 0}
.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem;align-items:end}
label{display:flex;flex-direction:column;gap:.35rem;font-size:.92rem;color:var(--muted)}input,button{border-radius:8px;border:1px solid #4b5563;background:#111827;color:var(--txt);padding:.55rem .65rem}
button{cursor:pointer;background:#164e63;border-color:#0891b2;font-weight:600}button:hover{background:#0e7490}
.news-list{list-style:none;padding:0;display:grid;gap:.9rem}.card{background:var(--card);border:1px solid #374151;border-radius:12px;padding:1rem}.card.high{border-left:4px solid var(--high)}
.top-row{display:flex;justify-content:space-between;color:var(--muted);font-size:.86rem}.title{display:inline-block;margin:.5rem 0 .35rem;color:var(--accent);text-decoration:none;font-weight:650}.title:hover{text-decoration:underline}
.summary{margin:.3rem 0;color:#d1d5db}.meta{margin:.4rem 0 0;color:var(--muted);font-size:.85rem}.empty{background:#1e293b;border:1px dashed #64748b;border-radius:12px;padding:1rem}
"""


@dataclass
class NewsItem:
    title: str
    link: str
    source: str
    published: datetime
    summary: str
    score: int


def parse_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None

    raw = raw.strip()
    for candidate in (raw, raw.replace("Z", "+00:00")):
        try:
            dt = datetime.fromisoformat(candidate)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    try:
        dt = parsedate_to_datetime(raw)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def get_text(element: ET.Element | None, path: str) -> str:
    if element is None:
        return ""
    found = element.find(path)
    return found.text.strip() if (found is not None and found.text) else ""


def normalize_link(item: ET.Element) -> str:
    direct = get_text(item, "link")
    if direct:
        return direct
    atom_link = item.find("{http://www.w3.org/2005/Atom}link")
    if atom_link is not None:
        return atom_link.attrib.get("href", "").strip()
    return ""


def extract_items(feed_name: str, xml_bytes: bytes) -> Iterable[NewsItem]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    now = datetime.now(timezone.utc)

    for item in root.findall(".//channel/item"):
        published = parse_datetime(get_text(item, "pubDate")) or now
        yield make_news_item(
            get_text(item, "title"),
            normalize_link(item),
            feed_name,
            published,
            get_text(item, "description"),
        )

    ns = "{http://www.w3.org/2005/Atom}"
    for entry in root.findall(f".//{ns}entry"):
        summary = get_text(entry, f"{ns}summary") or get_text(entry, f"{ns}content")
        published = parse_datetime(get_text(entry, f"{ns}updated") or get_text(entry, f"{ns}published")) or now
        yield make_news_item(
            get_text(entry, f"{ns}title"),
            normalize_link(entry),
            feed_name,
            published,
            summary,
        )


def calculate_score(text: str) -> int:
    t = text.lower()
    return sum(1 for term in PRIORITY_TERMS if term in t)


def make_news_item(title: str, link: str, source: str, published: datetime, summary: str) -> NewsItem:
    return NewsItem(
        title=title or "(Untitled)",
        link=link,
        source=source,
        published=published.astimezone(timezone.utc),
        summary=summary,
        score=calculate_score(f"{title} {summary}"),
    )


def fetch_feed(feed_name: str, url: str) -> list[NewsItem]:
    req = Request(url, headers={"User-Agent": "SOC-L3-News-Watcher/1.0"})
    try:
        with urlopen(req, timeout=12) as response:
            data = response.read()
    except URLError:
        return []
    return list(extract_items(feed_name, data))


def collect_news(hours_back: int, keyword: str) -> list[NewsItem]:
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(hours=max(hours_back, 1))
    keyword_l = keyword.lower().strip()

    output: list[NewsItem] = []
    for name, feed in FEEDS.items():
        for item in fetch_feed(name, feed):
            if item.published < threshold:
                continue
            if keyword_l and keyword_l not in f"{item.title} {item.summary}".lower():
                continue
            output.append(item)

    output.sort(key=lambda x: (x.score, x.published), reverse=True)
    return output


def render_page(items: list[NewsItem], hours_back: int, keyword: str) -> str:
    cards = []
    for item in items:
        cls = "card high" if item.score >= 2 else "card"
        safe_summary = escape(item.summary)[:350]
        cards.append(
            (
                f"<li class=\"{cls}\">"
                f"<div class=\"top-row\"><span>{escape(item.source)}</span><span>{item.published.strftime('%Y-%m-%d %H:%M UTC')}</span></div>"
                f"<a class=\"title\" href=\"{escape(item.link)}\" target=\"_blank\" rel=\"noopener noreferrer\">{escape(item.title)}</a>"
                f"<p class=\"summary\">{safe_summary}</p>"
                f"<p class=\"meta\">Priority signals matched: {item.score}</p>"
                "</li>"
            )
        )

    items_block = (
        f"<section><h2>Latest relevant items ({len(items)})</h2><ul class='news-list'>{''.join(cards)}</ul></section>"
        if items
        else "<section class='empty'><h2>No matching news in this time window</h2><p>Try expanding the time window or removing the keyword filter.</p></section>"
    )

    return f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
<title>SOC L3 Cybersecurity News Watch</title><style>{STYLE}</style></head>
<body><main class=\"container\"><header><h1>SOC L3 Cybersecurity News Watch</h1>
<p class=\"sub\">Curated high-priority cyber news for EDR/SIEM defenders. Monitoring {len(FEEDS)} sources. Generated at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}.</p></header>
<section class=\"panel\"><form method=\"get\" class=\"filters\">
<label>Time window (hours)<input type=\"number\" min=\"1\" max=\"168\" name=\"hours\" value=\"{hours_back}\" /></label>
<label>Optional keyword<input type=\"text\" name=\"keyword\" value=\"{escape(keyword)}\" placeholder=\"e.g., CrowdStrike, CVE-2026\" /></label>
<button type=\"submit\">Refresh Feed</button></form></section>{items_block}</main></body></html>"""


class NewsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        try:
            hours_back = int(params.get("hours", ["48"])[0])
        except ValueError:
            hours_back = 48
        keyword = params.get("keyword", [""])[0]

        items = collect_news(hours_back=hours_back, keyword=keyword)
        body = render_page(items, hours_back, keyword).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), NewsHandler)
    print(f"SOC L3 Cybersecurity News Watch running on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
