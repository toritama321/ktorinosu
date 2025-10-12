// GitHub Pagesでは、ルートが「https://...github.io/」になる。
// ルート相対パスを書く場合は、/<リポジトリ名>/を先頭につける必要がある。

// html要素からdata-baseを取得
const SITE_BASE = document.documentElement.dataset.base || "";

// パス組立
function joinBase(path) {
  const b = SITE_BASE.endsWith("/") ? SITE_BASE.slice(0, -1) : SITE_BASE; // data-base末尾スラッシュを取り除く
  const p = path.startsWith("/") ? path.slice(1) : path;  // 引数先頭スラッシュを取り除く
  return b ? `${b}/${p}` : p; // 「<data-base>/<引数>」を返す
}

// 現在ページのURL取得
function currentPage() {
  const url = new URL(window.location.href);  // 現在ページのURL取得

  // split=指定区切り文字で新配列化　.fillter()=指定条件のもののみ取り出す　.pop=最後の要素を取り除く
  // toLowerCase=文字列小文字化
  return (url.pathname.split("/").filter(Boolean).pop() || "index.html").toLowerCase();
}

// 「data-」系のパスを設定
function hydrateLinks(root) {
  // querySelectorAll("[data-href]")で、data-href属性を持つa要素をすべて取得
  root.querySelectorAll("[data-href]").forEach(a => {
    // data-hrefを相対パスに組み立て、href属性に追加
    a.setAttribute("href", joinBase(a.getAttribute("data-href")));
  });

  // 画像（src）
  root.querySelectorAll("[data-src]").forEach(img=>{
    img.setAttribute("src", joinBase(img.getAttribute("data-src")));
  });

  // レスポンシブ画像（srcset）
  root.querySelectorAll("[data-srcset]").forEach(el=>{
    el.setAttribute("srcset",
      el.getAttribute("data-srcset")
        .split(",")
        .map(s=>s.trim())
        .map(entry=>{
          const [path, size] = entry.split(/\s+/);
          return joinBase(path) + (size? ` ${size}` : "");
        })
        .join(", ")
    );
  });
}

// ヘッダー、フッター挿入　##################################################################
async function loadFragment(slot, url, cacheKey) {
  // ネットワークで最新化
  try {
    const res = await fetch(joinBase(url), { cache: "no-cache" });  // header.html を /<torinosu>/header.html に
    const html = await res.text();

    // 初回 or 内容更新時のみ差し替え（ミクロな再ペイントに抑える）
    slot.innerHTML = html;
    hydrateLinks(slot);
    if (!slot.classList.contains("is-ready")) readySlot(slot);
    sessionStorage.setItem(cacheKey, html);
  } catch (e) {
    console.error("include失敗:", url, e);
    // fetch失敗 → 最低限のフォールバック
    slot.innerHTML = `<div style="padding:12px;background:#fff;border-radius:8px">headerの読み込みに失敗しました</div>`;
    readySlot(slot);
  }
}

// ヘッダー、フッター読み込み
document.addEventListener("DOMContentLoaded", async () => {
  const headerSlot = document.querySelector('[data-include="header.html"]');
  const footerSlot = document.querySelector('[data-include="footer.html"]');

  const jobs = [];
  if (headerSlot) jobs.push(loadFragment(headerSlot, "header.html", "frag:header"));
  if (footerSlot) jobs.push(loadFragment(footerSlot, "footer.html", "frag:footer"));

  await Promise.all(jobs);
  highlightActiveNav();
});

// ヘッダーメニューの選択中ハイライト
function highlightActiveNav() {
  const page = currentPage();
  document.querySelectorAll("nav a[href]").forEach(a => {
    const target = (a.getAttribute("href") || "").split("/").pop()?.toLowerCase();
    if (target === page) a.classList.add("is-active");
  });
}

function readySlot(el) {
  el.classList.add("is-ready");     // visibility: visible
  el.classList.remove("u-invis");   // 透明解除
}


// スクロールボタンの表示・非表示###########################################################
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (document.documentElement.scrollTop > 200) {
    scrollTopBtn.style.display = "block"; // 200px以上スクロールで表示
  } else {
    scrollTopBtn.style.display = "none";  // それ以下なら隠す
  }
});

// ボタンを押したら上に戻る
scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth" // スムーズスクロール
  });
});
