(() => {
  "use strict";

  const DICT = {
    zh: {
      pageTitle: "★彡 SNOWCRAFT 打雪仗 彡★",
      marquee: "❄ 歡迎光臨 SNOWCRAFT 打雪仗小遊戲主頁 ❄ 本站最適合以 800x600 解析度瀏覽 ❄ 歡迎光臨 SNOWCRAFT 打雪仗小遊戲主頁 ❄",
      subtitle: "～經典打雪仗網頁遊戲～",
      startSubtitle: "經典打雪仗",
      startControls: "操作：點擊並按住紅帽角色移動，放開滑鼠投擲雪球",
      startBtn: "開始遊戲",
      gameOverTitle: "遊戲結束",
      restartBtn: "再玩一次",
      howtoTitle: "📜 遊戲說明 README.TXT 📜",
      howto1: "🖱️ 用滑鼠<b>點擊並按住</b>下方紅帽角色",
      howto2: "🖱️ 移動滑鼠<b>拖曳</b>該角色（只能在下半場活動）",
      howto3: "🖱️ <b>放開滑鼠</b>即可朝滑鼠方向投擲雪球，按住越久力道越強",
      howto4: "🎯 目標：打倒所有綠色敵人進入下一關",
      howto5: "❤️ 紅隊每位角色可承受 <b>2 次</b>命中，綠隊 <b>3 次</b>",
      howto6: "💀 全部紅隊倒下則遊戲結束",
      footerCopy: "Snowcraft 打雪仗小遊戲 ｜ 最佳瀏覽環境：Netscape Navigator 4.0 以上 😉",
      footerBlink: "👷 本網站持續施工中 👷",
      level: "第",
      levelSuffix: "關",
      stageClear: "過關！",
      scoreLabel: "分數：",
      langBtn: "EN"
    },
    en: {
      pageTitle: "★彡 SNOWCRAFT Snowball Fight 彡★",
      marquee: "❄ Welcome to the SNOWCRAFT snowball fight game ❄ Best viewed at 800x600 resolution ❄ Welcome to the SNOWCRAFT snowball fight game ❄",
      subtitle: "～A Classic Snowball Fight Web Game～",
      startSubtitle: "Classic Snowball Fight",
      startControls: "How to play: click and hold a red-hat character to move, release to throw a snowball",
      startBtn: "Start Game",
      gameOverTitle: "Game Over",
      restartBtn: "Play Again",
      howtoTitle: "📜 HOW TO PLAY - README.TXT 📜",
      howto1: "🖱️ <b>Click and hold</b> a red-hat character with your mouse",
      howto2: "🖱️ Move the mouse to <b>drag</b> the character (bottom half only)",
      howto3: "🖱️ <b>Release the mouse</b> to throw a snowball toward it — the longer you hold, the stronger the throw",
      howto4: "🎯 Goal: defeat all green enemies to advance to the next level",
      howto5: "❤️ Each red teammate can take <b>2 hits</b>, each green enemy <b>3 hits</b>",
      howto6: "💀 Game over when all red teammates are down",
      footerCopy: "Snowcraft Snowball Fight Game ｜ Best viewed with Netscape Navigator 4.0+ 😉",
      footerBlink: "👷 THIS SITE IS UNDER CONSTRUCTION 👷",
      level: "Level ",
      levelSuffix: "",
      stageClear: "Stage Clear!",
      scoreLabel: "Score: ",
      langBtn: "中文"
    }
  };

  const STORAGE_KEY = "snowcraft_lang";

  function getLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" ? "en" : "zh";
  }

  function t(key) {
    // BUG FIX: `||` treats an intentionally-empty translation (e.g. English's
    // levelSuffix: "") as missing and falls back to Chinese, so English
    // rendered "Level 1關". Check for undefined explicitly instead.
    const lang = getLang();
    const val = DICT[lang] && DICT[lang][key];
    if (val !== undefined) return val;
    const zhVal = DICT.zh[key];
    return zhVal !== undefined ? zhVal : key;
  }

  function applyI18n() {
    const lang = getLang();
    document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const val = t(key);
      if (val != null) el.innerHTML = val;
    });
    document.title = t("pageTitle");
    const langBtn = document.getElementById("lang-toggle");
    if (langBtn) langBtn.textContent = t("langBtn");
  }

  function toggleLang() {
    const next = getLang() === "zh" ? "en" : "zh";
    localStorage.setItem(STORAGE_KEY, next);
    applyI18n();
    // Let game.js refresh any live, dynamically-set text (level/score labels).
    if (window.SNOWCRAFT_ON_LANG_CHANGE) window.SNOWCRAFT_ON_LANG_CHANGE();
  }

  window.SNOWCRAFT_I18N = { t, getLang };

  document.addEventListener("DOMContentLoaded", () => {
    applyI18n();
    const langBtn = document.getElementById("lang-toggle");
    if (langBtn) langBtn.addEventListener("click", toggleLang);
  });
})();
