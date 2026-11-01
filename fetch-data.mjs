// 雲・風・海流マップの公開用データを Open-Meteo から取得し、dist/data.json に保存する。
// 使い方：node fetch-data.mjs（約3分。無料枠の回数制限の内側に収まるよう、間をあけて取得する）

import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT_FILE = path.join("dist", "data.json");
const BATCH_SIZE = 100;
const BATCH_INTERVAL_MS = 12500; // 1分あたり約480地点（上限600地点/分の内側）

const STEP = 1;
const lats = range(24, 46, STEP);
const lons = range(122, 150, STEP);

const COMMON = "past_days=1&forecast_days=2&timezone=Asia%2FTokyo";
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?hourly=wind_speed_10m,wind_direction_10m,cloud_cover&wind_speed_unit=ms&${COMMON}`;
const MARINE_URL = `https://marine-api.open-meteo.com/v1/marine?hourly=ocean_current_velocity,ocean_current_direction&cell_selection=sea&${COMMON}`;

function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(v, digits) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

async function fetchBatch(baseUrl, points) {
  const la = points.map((p) => p.lat).join(",");
  const lo = points.map((p) => p.lon).join(",");
  const url = `${baseUrl}&latitude=${la}&longitude=${lo}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : [json];
    }
    if (res.status !== 429 || attempt >= 2) throw new Error(`データ提供元のエラー（${res.status}）`);
    await sleep(65000); // 回数制限にかかったら1分あけて再試行（最大2回）
  }
}

async function fetchAll(label, baseUrl, points) {
  const results = [];
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_INTERVAL_MS);
    results.push(...(await fetchBatch(baseUrl, points.slice(i, i + BATCH_SIZE))));
    console.log(`${label}: ${results.length}/${points.length}`);
  }
  return results;
}

function buildData(points, weather, marine) {
  const times = weather[0].hourly.time;
  const emptyFrames = () => times.map(() => new Array(points.length).fill(null));
  const wind = { u: emptyFrames(), v: emptyFrames() };
  const current = { u: emptyFrames(), v: emptyFrames() };
  const cloud = emptyFrames();

  points.forEach((p, i) => {
    const w = weather[i].hourly;
    const m = marine[i];
    // 陸地の地点は近くの海の値が返るので、離れている場合は「海なし」として扱う
    const isSea = Math.abs(m.latitude - p.lat) <= 0.35 && Math.abs(m.longitude - p.lon) <= 0.35;
    times.forEach((_, t) => {
      const speed = w.wind_speed_10m[t];
      const dir = w.wind_direction_10m[t];
      if (speed !== null && dir !== null) {
        // 風向は「吹いてくる方向」
        const rad = (dir * Math.PI) / 180;
        wind.u[t][i] = round(-speed * Math.sin(rad), 1);
        wind.v[t][i] = round(-speed * Math.cos(rad), 1);
      }
      cloud[t][i] = w.cloud_cover[t];

      const curSpeed = m.hourly.ocean_current_velocity[t];
      const curDir = m.hourly.ocean_current_direction[t];
      if (isSea && curSpeed !== null && curDir !== null) {
        // 流向は「流れていく方向」。km/h を m/s に直す
        const rad = (curDir * Math.PI) / 180;
        current.u[t][i] = round((curSpeed / 3.6) * Math.sin(rad), 2);
        current.v[t][i] = round((curSpeed / 3.6) * Math.cos(rad), 2);
      }
    });
  });
  return { fetchedAt: new Date().toISOString(), times, lats, lons, wind, current, cloud };
}

const points = [];
for (const lat of lats) for (const lon of lons) points.push({ lat, lon });

const weather = await fetchAll("雲・風", WEATHER_URL, points);
const marine = await fetchAll("海流", MARINE_URL, points);

// 途中で失敗しても前回のファイルを壊さないよう、一時ファイルに書いてから置き換える
mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const tmp = `${OUT_FILE}.tmp`;
writeFileSync(tmp, JSON.stringify(buildData(points, weather, marine)));
renameSync(tmp, OUT_FILE);
console.log(`保存しました: ${OUT_FILE}（${Math.round(statSync(OUT_FILE).size / 1024)}KB）`);
