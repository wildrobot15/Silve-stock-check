const SYMBOL = "SILVERBEES.NS";
const TV_SYMBOL = "NSE:SILVERBEES";
const DAILY_URL = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=1d&range=3mo`;
const INTRADAY_URL = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=5m&range=1d`;

const FALLBACK_SITES = [
  { name: "TradingView", url: `https://www.tradingview.com/symbols/${TV_SYMBOL.replace(":", "-")}/` },
  { name: "Finviz", url: "https://finviz.com/" },
  { name: "Barchart", url: "https://www.barchart.com/" },
  { name: "Yahoo Finance", url: `https://finance.yahoo.com/quote/${SYMBOL}` },
  { name: "StockCharts", url: "https://stockcharts.com/" },
  { name: "Candlecharts", url: "https://www.candlecharts.com/" },
  { name: "Investing.com", url: "https://www.investing.com/" },
  { name: "Tickertape", url: "https://www.tickertape.in/" },
  { name: "Research 360", url: "https://research360.in/" },
];

const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

const snapshotTimeEl = document.getElementById("snapshotTime");
const currentPriceEl = document.getElementById("currentPrice");
const ohlcEl = document.getElementById("ohlc");
const buySignalEl = document.getElementById("buySignal");
const sellSignalEl = document.getElementById("sellSignal");
const bestBuyPriceEl = document.getElementById("bestBuyPrice");
const bestSellPriceEl = document.getElementById("bestSellPrice");
const intradayBestBuyPriceEl = document.getElementById("intradayBestBuyPrice");
const intradayBestSellPriceEl = document.getElementById("intradayBestSellPrice");
const intradaySignalEl = document.getElementById("intradaySignal");
const reasonEl = document.getElementById("reason");

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildCandles(quote) {
  const candles = [];
  for (let i = 0; i < quote.open.length; i += 1) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    if ([open, high, low, close].every((v) => typeof v === "number")) {
      candles.push({ open, high, low, close });
    }
  }
  return candles;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function analyzeDailyCandles(candles) {
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const closes = candles.map((candle) => candle.close);

  const shortMA = average(closes.slice(-5));
  const longMA = average(closes.slice(-20));

  const body = Math.abs(latest.close - latest.open);
  const range = latest.high - latest.low;
  const isDoji = range > 0 && body / range < 0.15;

  const bullishEngulfing =
    previous.close < previous.open &&
    latest.close > latest.open &&
    latest.open <= previous.close &&
    latest.close >= previous.open;

  const bearishEngulfing =
    previous.close > previous.open &&
    latest.close < latest.open &&
    latest.open >= previous.close &&
    latest.close <= previous.open;

  const supportWindow = candles.slice(-10);
  const resistanceWindow = candles.slice(-10);
  const liveBestBuyPrice = Math.min(...supportWindow.map((candle) => candle.low));
  const liveBestSellPrice = Math.max(...resistanceWindow.map((candle) => candle.high));

  let buy = "NO";
  let sell = "NO";
  const reasons = [];

  if (shortMA > longMA) {
    reasons.push("Daily trend is bullish (5MA above 20MA)");
    buy = "YES";
  } else {
    reasons.push("Daily trend is weak (5MA below 20MA)");
    sell = "YES";
  }

  if (bullishEngulfing) {
    reasons.push("Bullish engulfing candle detected");
    buy = "YES";
    sell = "NO";
  }

  if (bearishEngulfing) {
    reasons.push("Bearish engulfing candle detected");
    sell = "YES";
    buy = "NO";
  }

  if (isDoji) {
    reasons.push("Doji candle detected, market indecision");
    buy = "NO";
    sell = "NO";
  }

  return {
    latest,
    buy,
    sell,
    liveBestBuyPrice,
    liveBestSellPrice,
    reasons: reasons.join(". "),
  };
}

function analyzeIntradayCandles(candles) {
  const latest = candles[candles.length - 1];
  const recent = candles.slice(-15);
  const closes = candles.map((candle) => candle.close);
  const shortMA = average(closes.slice(-5));
  const longMA = average(closes.slice(-12));

  const liveBestBuyPrice = Math.min(...recent.map((candle) => candle.low));
  const liveBestSellPrice = Math.max(...recent.map((candle) => candle.high));

  let signal = "HOLD";
  if (latest.close > shortMA && shortMA > longMA) {
    signal = "INTRADAY BUY ZONE";
  } else if (latest.close < shortMA && shortMA < longMA) {
    signal = "INTRADAY SELL ZONE";
  }

  return { liveBestBuyPrice, liveBestSellPrice, signal };
}

function analyzeTradingViewSnapshot(candle, recommendAll) {
  const liveBestBuyPrice = candle.low;
  const liveBestSellPrice = candle.high;

  let buy = "NO";
  let sell = "NO";
  if (recommendAll > 0.2) {
    buy = "YES";
  } else if (recommendAll < -0.2) {
    sell = "YES";
  }

  return {
    latest: candle,
    buy,
    sell,
    liveBestBuyPrice,
    liveBestSellPrice,
    reasons:
      "Yahoo daily candle history unavailable. Used TradingView live snapshot and recommendation score.",
  };
}

async function fetchJson(url, options = { method: "GET", headers: { Accept: "application/json" } }) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchYahooQuoteData(url) {
  const errors = [];

  try {
    const data = await fetchJson(url);
    const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!quote) {
      throw new Error("Unexpected Yahoo response format");
    }
    return { quote, source: "Yahoo Finance" };
  } catch (error) {
    errors.push(`Yahoo Finance: ${error.message}`);
  }

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const data = await fetchJson(proxyUrl);
    const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!quote) {
      throw new Error("Unexpected Yahoo proxy response format");
    }
    return { quote, source: "Yahoo via AllOrigins proxy" };
  } catch (error) {
    errors.push(`Yahoo via AllOrigins proxy: ${error.message}`);
  }

  throw new Error(errors.join(" | "));
}

async function fetchTradingViewSnapshot() {
  const data = await fetchJson("https://scanner.tradingview.com/india/scan", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      symbols: {
        tickers: [TV_SYMBOL],
        query: { types: [] },
      },
      columns: ["open", "high", "low", "close", "Recommend.All"],
    }),
  });

  const row = data?.data?.[0];
  const values = row?.d;
  if (!row || !Array.isArray(values) || values.length < 5) {
    throw new Error("Unexpected TradingView response format");
  }

  const [open, high, low, close, recommendAll] = values;
  if ([open, high, low, close].some((value) => typeof value !== "number")) {
    throw new Error("TradingView returned incomplete OHLC values");
  }

  return {
    candle: { open, high, low, close },
    recommendAll: typeof recommendAll === "number" ? recommendAll : 0,
    source: "TradingView India Scanner",
  };
}

async function checkAlternativeSites() {
  const checks = await Promise.all(
    FALLBACK_SITES.map(async (site) => {
      const probeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(site.url)}`;
      try {
        const response = await fetch(probeUrl, {
          method: "GET",
          headers: { Accept: "text/html" },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return `${site.name}: reachable`;
      } catch (_error) {
        return `${site.name}: not reachable from browser (CORS/proxy/rate-limit)`;
      }
    })
  );

  return checks.join(" | ");
}

function clearSignals() {
  buySignalEl.textContent = "-";
  sellSignalEl.textContent = "-";
  bestBuyPriceEl.textContent = "-";
  bestSellPriceEl.textContent = "-";
  intradayBestBuyPriceEl.textContent = "-";
  intradayBestSellPriceEl.textContent = "-";
  intradaySignalEl.textContent = "-";

  buySignalEl.className = "";
  sellSignalEl.className = "";
  bestBuyPriceEl.className = "";
  bestSellPriceEl.className = "";
  intradayBestBuyPriceEl.className = "";
  intradayBestSellPriceEl.className = "";
  intradaySignalEl.className = "";
}

async function runDailyCheck() {
  statusEl.textContent = "Fetching daily and intraday market data...";
  startBtn.disabled = true;

  try {
    let dailyAnalysis;
    let dailySource;

    try {
      const dailyData = await fetchYahooQuoteData(DAILY_URL);
      const dailyCandles = buildCandles(dailyData.quote);
      if (dailyCandles.length < 20) {
        throw new Error("Not enough daily candles for analysis");
      }
      dailyAnalysis = analyzeDailyCandles(dailyCandles);
      dailySource = dailyData.source;
    } catch (dailyError) {
      const tvSnapshot = await fetchTradingViewSnapshot();
      dailyAnalysis = analyzeTradingViewSnapshot(tvSnapshot.candle, tvSnapshot.recommendAll);
      dailySource = `${tvSnapshot.source} (Daily fallback)`;
      dailyAnalysis.reasons = `${dailyAnalysis.reasons}. Yahoo error: ${dailyError.message}`;
    }

    let intradayNote = "";
    try {
      const intradayData = await fetchYahooQuoteData(INTRADAY_URL);
      const intradayCandles = buildCandles(intradayData.quote);
      if (intradayCandles.length < 12) {
        throw new Error("Not enough intraday candles");
      }

      const intradayAnalysis = analyzeIntradayCandles(intradayCandles);
      intradayBestBuyPriceEl.textContent = formatPrice(intradayAnalysis.liveBestBuyPrice);
      intradayBestBuyPriceEl.className = "positive";

      intradayBestSellPriceEl.textContent = formatPrice(intradayAnalysis.liveBestSellPrice);
      intradayBestSellPriceEl.className = "negative";

      intradaySignalEl.textContent = `${intradayAnalysis.signal} (source: ${intradayData.source})`;
      intradaySignalEl.className = intradayAnalysis.signal.includes("BUY")
        ? "positive"
        : intradayAnalysis.signal.includes("SELL")
        ? "negative"
        : "";
    } catch (intradayError) {
      intradayBestBuyPriceEl.textContent = "-";
      intradayBestSellPriceEl.textContent = "-";
      intradaySignalEl.textContent = "INTRADAY DATA NOT AVAILABLE";
      intradaySignalEl.className = "negative";
      intradayNote = ` Intraday fetch error: ${intradayError.message}.`;
    }

    const now = new Date();
    snapshotTimeEl.textContent = now.toLocaleString("en-IN");
    currentPriceEl.textContent = formatPrice(dailyAnalysis.latest.close);
    ohlcEl.textContent = `${dailyAnalysis.latest.open.toFixed(2)} / ${dailyAnalysis.latest.high.toFixed(
      2
    )} / ${dailyAnalysis.latest.low.toFixed(2)} / ${dailyAnalysis.latest.close.toFixed(2)}`;

    buySignalEl.textContent = dailyAnalysis.buy;
    buySignalEl.className = dailyAnalysis.buy === "YES" ? "positive" : "negative";

    sellSignalEl.textContent = dailyAnalysis.sell;
    sellSignalEl.className = dailyAnalysis.sell === "YES" ? "positive" : "negative";

    bestBuyPriceEl.textContent = formatPrice(dailyAnalysis.liveBestBuyPrice);
    bestBuyPriceEl.className = "positive";

    bestSellPriceEl.textContent = formatPrice(dailyAnalysis.liveBestSellPrice);
    bestSellPriceEl.className = "negative";

    reasonEl.textContent = `${dailyAnalysis.reasons}. Daily source: ${dailySource}.${intradayNote}`;

    statusEl.textContent = "Daily check completed.";
    resultEl.classList.remove("hidden");
  } catch (error) {
    const siteChecks = await checkAlternativeSites();
    statusEl.textContent =
      "Daily check failed. Tried Yahoo, TradingView, and additional market sites. Check technical details below.";
    reasonEl.textContent = `Technical details: ${error.message} | Alternative site check: ${siteChecks}`;
    resultEl.classList.remove("hidden");
    clearSignals();
  } finally {
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", runDailyCheck);
