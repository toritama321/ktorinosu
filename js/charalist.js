// ベースパス（リポ名に合わせる）
const BASE_PATH = '/ktorinosu/';

// 安全にくっつける関数
function withBase(path) {
  if (!path) return '';
  // すでに http:// や /torinosu/ で始まってたらそのまま
  if (/^(https?:|\/ktorinosu\/)/.test(path)) return path;
  // ../ を消して BASE_PATH にくっつける
  return BASE_PATH + path.replace(/^(\.\/|\.\.\/)+/, '');
}

// 設定　########################################################################
// JSONファイル
const JSON_SOURCES = [
  "../data/ikukyo.json",
  "../data/jinyou.json",
  "../data/shirokuro.json",
  "../data/kyomukyo.json",
  "../data/shinra.json",
  "../data/vertual.json",
  "../data/sca.json",
  "../data/kontate.json",
];

// ページファイル名 のマップ（必要に応じて追加）
const WORLD_TO_PAGE = {
  "異空郷": "ikukyo",
  "神妖の巫女": "jinyou",
  "白黒幻想曲": "shirokuro",
  "東方鏡夢郷": "kyomukyo",
  "心羅万象大戦": "shinra",
  "バチャシティ": "vertual",
  "君もクズを育てよう！": "sca",
  "混沌と記憶の盾": "kontate",
};

function slugWorldToPage(worldName) {
  return WORLD_TO_PAGE[worldName] || "index"; // 未登録ならフォールバック
}

function buildHref(item) {
  const world = item.world || (item.tags?.[0] || "");   // ルール: 世界は tags[0]
  const page  = slugWorldToPage(world);
  const id    = encodeURIComponent(item.id || item.name);
  // ハッシュは1個しか使えないので、"&"でパラメータを繋ぐ
  console.log('ジャンプ先URL：',`/ktorinosu/world/${page}.html#tab=chars&char=${id}`);
  return `/ktorinosu/world/${page}.html#tab=chars&char=${id}`;
}

// タグ生成　########################################################################
function splitFacets(tags = [] = {}) {
  let gender = ""; let hair = ""; let eye = ""; let height = ""; let world = "";
  const rest = [];
  for (const t of tags) {
    if (t === "男" || t === "女" || t === "性別不明") { gender = t; continue; }
    if (t.startsWith("髪色：")) { hair = t.slice("髪色：".length); continue; }
    if (t.startsWith("瞳色：")) { eye = t.slice("瞳色：".length); continue; }
    if (t.startsWith("身長：")) { height = t.slice("身長：".length); continue; }
    if (!world && t && !t.includes("：")) { world = tags.length > 0 ? tags[0] : "";; continue; }
    rest.push(t);
  }
  return { gender, hair, eye, height, world, rest };
}

// 残りタグ（ファセット以外）でチップを作る
function renderTagChips(allTags) {
  const wrap = document.getElementById('tagChips');
  wrap.innerHTML = '';
  const makeChip = (label, value) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label; b.dataset.value = value; b.setAttribute('aria-pressed','false');
    b.addEventListener('click', () => { const pressed = b.getAttribute('aria-pressed') === 'true'; b.setAttribute('aria-pressed', pressed ? 'false' : 'true'); applyFilter(); });
    return b;
  };
  allTags.sort((a,b)=>a.localeCompare(b,'ja')).forEach(tag => wrap.appendChild(makeChip(tag, tag)));
}

// 各ファセットの選択肢をデータから作る
function renderFacetOptions(list) {
  const worldSel = document.getElementById('facetWorld');
  const hairSel  = document.getElementById('facetHair');
  const eyeSel   = document.getElementById('facetEye');
  const htSel    = document.getElementById('facetHeight');

  const worlds = [...new Set(list.map(x => x.world).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  const hairs  = [...new Set(list.map(x => x.hair).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  const eyes   = [...new Set(list.map(x => x.eye).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  const hts    = [...new Set(list.map(x => x.height).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));

  const fill = (sel, values) => {
    sel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
    values.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
  };
  fill(worldSel, worlds); fill(hairSel, hairs); fill(eyeSel, eyes); fill(htSel, hts);
}

// タグ絞り込み　########################################################################
function currentSelectedTags() { return [...document.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.value); }
function currentFacet() {
  return {
    world:  document.getElementById('facetWorld').value || "",
    gender: document.getElementById('facetGender').value || "",
    hair:   document.getElementById('facetHair').value   || "",
    eye:    document.getElementById('facetEye').value    || "",
    height: document.getElementById('facetHeight').value || ""
  };
}

function applyFilter() {
  const selectedTags = currentSelectedTags();
  const facet = currentFacet();
  const cards = document.querySelectorAll('.char-card');

  cards.forEach(c => {
    const tags = (c.dataset.tags || '').split(',').filter(Boolean);
    const facetOK =
      (!facet.world  || facet.world  === c.dataset.world) &&
      (!facet.gender || facet.gender === c.dataset.gender) &&
      (!facet.hair   || facet.hair   === c.dataset.hair) &&
      (!facet.eye    || facet.eye    === c.dataset.eye) &&
      (!facet.height || facet.height === c.dataset.height);
    const tagsOK = selectedTags.every(t => tags.includes(t));
    c.classList.toggle('hidden', !(facetOK && tagsOK));
  });
  //refreshLazy();
}

function collectTags(list) {
  const set = new Set();
  list.forEach(m => (m.tags || []).forEach(t => set.add(t)));
  return [...set];
}

// JSONロード　########################################################################
async function loadAll() {
  const lists = await Promise.all(JSON_SOURCES.map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`JSON取得失敗: ${url}`);
    const j = await res.json();

    let items = [];
    if (Array.isArray(j)) items = j;
    else if (Array.isArray(j.groups)) items = j.groups.flatMap(g => (g.members || []).map(m => ({ ...m, group: g.title })));
    else if (Array.isArray(j.members)) items = j.members;
    else items = j.chars || j.characters || j.items || j.list || j.data || [];

    return items.map(raw => {
      const name = raw.name ?? raw.title ?? "";
      const img  = raw.img ?? raw.image ?? "";
      const href = raw.href ? raw.href : `./${raw.id || name}.html`;
      const tags = Array.isArray(raw.tags) ? raw.tags : [];
      const groupTitle = raw.group || "";
      const facets = splitFacets(tags, { groupTitle });
      return { ...raw, name, img, href, tags: facets.rest, ...facets };
    });
  }));

  return lists.flat();
}

// カード生成
function renderGrid(list) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  list.forEach((m) => {
    const card = document.createElement('article');
    card.className = 'char-card';
    card.dataset.id = m.id || '';
    card.dataset.tags = (m.tags || []).join(',');
    card.dataset.world = m.world || '';
    card.dataset.gender = m.gender || '';
    card.dataset.hair = m.hair || '';
    card.dataset.eye = m.eye || '';
    card.dataset.height = m.height || '';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.addEventListener('click', () => { const url = buildHref(m); if (url) location.href = url; });

    const imgWrap = document.createElement('div');
    imgWrap.className = 'char-img';
    const img = makeImg(m.img, m.name);
    imgWrap.appendChild(img);
    img.loading = 'lazy'; img.decoding = 'async'; img.src = m.img || ''; img.alt = m.name || '';
    imgWrap.appendChild(img);

    const namebar = document.createElement('div');
    namebar.className = 'namebar';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = m.name || '';
    const arrow = document.createElement('div'); arrow.className = 'arrow'; arrow.textContent = '▶';
    namebar.append(name, arrow);

    trigger.append(imgWrap, namebar);
    card.append(trigger);
    frag.append(card);
  });

  grid.append(frag);
}

// 初期化　########################################################################
(async function init(){
  try {
    const data = await loadAll();
    renderGrid(data);
    renderFacetOptions(data);
    renderTagChips(collectTags(data));
    renderGrid(data);
    refreshLazy();

    // ファセット変更
    ['facetWorld','facetGender','facetHair','facetEye','facetHeight']
      .forEach(id => document.getElementById(id).addEventListener('change', applyFilter));

    // 解除ボタン
    document.getElementById('clearFilter').addEventListener('click', () => {
      document.querySelectorAll('.chip[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed','false'));
      ['facetWorld','facetGender','facetHair','facetEye','facetHeight'].forEach(id => document.getElementById(id).value = "");
      applyFilter();
    });
  } catch (e) {
    console.error(e);
    const grid = document.getElementById('grid');
    grid.innerHTML = '<p>データの読み込みに失敗しました。</p>';
  }
})();

// 画像読み込み　########################################################################
// グローバル：Lazy用オブザーバ
const io = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target;
        io.unobserve(img);
        hydrateImg(img);
      }
    }, { root: null, rootMargin: '200px 0px', threshold: 0.01 })
  : null; // 古い環境は即時ロード

function makeImg(src, alt) {
  const img = new Image();
  img.alt = alt || '';
  img.decoding = 'async';
  img.loading = 'lazy';              // 互換ありブラウザならこれも効く
  img.dataset.src = src || '';
  img.onerror = () => retryImg(img);
  if (io) {
    // まずはdata-srcのまま監視。可視になったらhydrateImgがsrcを入れる
    io.observe(img);
  } else {
    hydrateImg(img); // フォールバック：即ロード
  }
  return img;
}

function hydrateImg(img) {
  if (img.dataset.hydrated === '1') return;
  img.dataset.hydrated = '1';
  const src = img.dataset.src || '';
  if (!src) return;
  img.src = src;
}

function retryImg(img) {
  const tries = +(img.dataset.tries || 0);
  if (tries >= 2) return; // 最大2回まで
  img.dataset.tries = String(tries + 1);
  // 少し遅らせて再試行
  setTimeout(() => {
    // 一旦クリアして再セットすると再リクエストされやすい
    img.removeAttribute('src');
    setTimeout(() => hydrateImg(img), 50);
  }, 300 * (tries + 1));
}

// 可視状態が変わった/フィルター後に呼ぶと再監視される
function refreshLazy() {
  document.querySelectorAll('.char-card:not(.hidden) img[data-src]:not([data-hydrated="1"])')
    .forEach(img => io ? io.observe(img) : hydrateImg(img));

}


