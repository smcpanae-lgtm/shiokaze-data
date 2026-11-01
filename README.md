# shiokaze-data

AIドライブプランナーの雲・風・海流マップ（`/shiokaze`）で使うデータを、6時間ごとに作って配信します。

- 配信先：https://smcpanae-lgtm.github.io/shiokaze-data/data.json
- 元データ：[Weather data by Open-Meteo.com](https://open-meteo.com/)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）を加工。海流の元データは Météo-France、Copernicus Marine Service
- 航海・釣りなどの安全判断には使えません。

## 初回の設定

1. このフォルダの内容を公開リポジトリ `shiokaze-data` に push する。
2. リポジトリの Settings → Pages の Source を「GitHub Actions」にする。
3. Actions 画面の「データの更新と配信」を手動で1回実行し、配信先を開いて確かめる。

## 使用量

1回の更新で約1,334回（667地点×2種類）Open-Meteo を呼びます。1日4回で約5,300回、1か月で約16万回です（無料枠は1日1万回未満、1か月30万回）。更新回数を増やす前に計算し直してください。
