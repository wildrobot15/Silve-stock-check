const SYMBOL = "SILVERBEES.NS";
const BASE_URL = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=1d&range=3mo`;

const DATA_ENDPOINTS = [
  {
    name: "Yahoo Finance",
    url: BASE_URL,
    parser: (data) => {
      const result = data?.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      if (!result || !quote) {
        throw new Error("Unexpected response format from Yahoo Finance");
      }
      return quote;
    },
  },
  {
    name: "Yahoo via AllOrigins proxy",
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent(BASE_URL)}`,
    parser: (data) => {
      const result = data?.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      if (!result || !quote) {
        throw new Error("Unexpected response format from proxy provider");
      }
      return quote;
    },
  },
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

function analyzeCandles(candles) {
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
    reasons.push("Short-term trend is above long-term trend (bullish momentum)");
    buy = "YES";
  } else {
    reasons.push("Short-term trend is below long-term trend (weak momentum)");
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
    reasons.push("Doji candle detected: market indecision, act cautiously");
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

async function fetchQuoteData() {
  const errors = [];

  for (const endpoint of DATA_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const quote = endpoint.parser(data);

      return {
        quote,
        source: endpoint.name,
      };
    } catch (error) {
      errors.push(`${endpoint.name}: ${error.message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function runDailyCheck() {
  statusEl.textContent = "Fetching latest market data...";
  startBtn.disabled = true;

  try {
    const { quote, source } = await fetchQuoteData();

    const candles = buildCandles(quote);
    if (candles.length < 20) {
      throw new Error("Not enough candle data for analysis");
    }

    const analysis = analyzeCandles(candles);
    const now = new Date();

    snapshotTimeEl.textContent = now.toLocaleString("en-IN");
    currentPriceEl.textContent = formatPrice(analysis.latest.close);
    ohlcEl.textContent = `${analysis.latest.open.toFixed(2)} / ${analysis.latest.high.toFixed(
      2
    )} / ${analysis.latest.low.toFixed(2)} / ${analysis.latest.close.toFixed(2)}`;

    buySignalEl.textContent = analysis.buy;
    buySignalEl.className = analysis.buy === "YES" ? "positive" : "negative";

    sellSignalEl.textContent = analysis.sell;
    sellSignalEl.className = analysis.sell === "YES" ? "positive" : "negative";

    bestBuyPriceEl.textContent = formatPrice(analysis.liveBestBuyPrice);
    bestBuyPriceEl.className = "positive";

    bestSellPriceEl.textContent = formatPrice(analysis.liveBestSellPrice);
    bestSellPriceEl.className = "negative";

    reasonEl.textContent = `${analysis.reasons}. Data source: ${source}.`;

    statusEl.textContent = "Daily check completed.";
    resultEl.classList.remove("hidden");
  } catch (error) {
    statusEl.textContent =
      "Daily check failed. This usually happens due to market-data provider blocking browser requests (CORS/rate limit). Please retry in a moment.";
    reasonEl.textContent = `Technical details: ${error.message}`;
    resultEl.classList.remove("hidden");
    buySignalEl.textContent = "-";
    sellSignalEl.textContent = "-";
    bestBuyPriceEl.textContent = "-";
    bestSellPriceEl.textContent = "-";
    buySignalEl.className = "";
    sellSignalEl.className = "";
    bestBuyPriceEl.className = "";
    bestSellPriceEl.className = "";
  } finally {
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", runDailyCheck);
