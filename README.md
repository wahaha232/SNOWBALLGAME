# Snowcraft - 打雪仗（現代網頁重製版）

經典 1998 年 Nicholson NY 的 Snowcraft 網頁遊戲 HTML5 重製版。

## 如何遊玩

1. 直接用瀏覽器開啟 `index.html`（支援 Chrome、Firefox、Safari、Edge 等主流瀏覽器）
2. 點擊「開始遊戲」
3. **操作方式**：
   - 用滑鼠（或手指）點擊並**按住**下方紅色帽子角色
   - 移動滑鼠來移動該角色（只能在下半場活動）
   - **放開**滑鼠即可朝滑鼠方向投擲雪球
   - 按住越久，雪球力道越強
4. 目標：打倒所有綠色敵人進入下一關
5. 紅隊每位角色可承受 **2 次**命中，綠隊 **3 次**
6. 全部紅隊倒下則遊戲結束

## 檔案結構

```
snowcraft-game/
├── index.html          # 網頁進入點
├── style.css           # 畫面樣式（全螢幕適應、UI）
├── game.js             # 遊戲核心邏輯（Canvas 繪製、AI、物理碰撞）
├── manifest.json       # PWA 設定（可「新增至主畫面」）
├── README.md
└── assets/
    ├── images/
    │   ├── sprites.png # 精靈圖集（遊戲主要用程式繪製，此為備用）
    │   └── favicon.ico # 瀏覽器圖示
    └── audio/
        ├── throw.mp3   # 投擲音效
        ├── hit.mp3     # 命中音效
        ├── splat.mp3   # 落地/撞牆
        ├── win.mp3     # 過關
        └── lose.mp3    # 失敗
```

## 技術特點

- 純 HTML5 Canvas + JavaScript，無需任何框架或外掛
- 角色與雪球皆由程式即時繪製（無需依賴 sprites 也能玩）
- 音效：優先播放 `assets/audio/` 內的 mp3 檔案，若載入/播放失敗則自動改用 Web Audio API 合成音效
- Canvas 依 devicePixelRatio 繪製，retina/高解析度螢幕畫面清晰不模糊
- 響應式設計，桌面與手機皆可遊玩，視窗縮放或旋轉裝置時角色與雪球會等比例重新定位
- 敵人 AI 會依目標距離與重力精確計算投擲角度與力道（等級越高瞄準越準）
- 支援 PWA（可安裝到手機主畫面）

## 本地測試

用任何靜態伺服器開啟即可，例如：

```bash
npx serve .
# 或
python3 -m http.server 8080
```

然後瀏覽器開啟對應網址。

祝玩得開心！❄
