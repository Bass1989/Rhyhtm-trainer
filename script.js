/* -------------------------------------------
 *  1. 定数とグローバル状態変数
 * ------------------------------------------- */
const DEFAULT_TEMPO = 120;
const AC = new (window.AudioContext || window.webkitAudioContext)();

let currentIndex = -1;
let visualObj = null;
let synth = null;
let isPlaying = false;
let currentMode = 'rhythm'; // 新しい状態変数: 'rhythm' or 'jazz'


/* -------------------------------------------
 *  2. DOM要素の参照
 * ------------------------------------------- */
const paperEl = document.getElementById("paper");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const tempoSlider = document.getElementById("tempoSlider");
const tempoVal = document.getElementById("tempoVal");
const modeRhythmBtn = document.getElementById("modeRhythmBtn");
const modeJazzBtn = document.getElementById("modeJazzBtn");


/* -------------------------------------------
 *  3. ABC記法データ
 * ------------------------------------------- */
const header = (tempo) => {
    // 現在のモードが'rhythm'の場合のみ、固定のタイトルを挿入する
    const titleLine = currentMode === 'rhythm' ? 'T:Rhythm Pattern\n' : '';
    return `X:1
${titleLine}M:4/4
L:1/8
Q:1/4=${tempo}
%%rhythm swing
K:C
`;
};

// データソースを2つに分割
const PATTERNS = [
  "| z2 CC- C2 CC |", // 88 Basie Street
  "| z2 z C-C2 C2 |",  // Caravan #1
  "| C3 C- C4 |",  // Caravan #2
  "| z C3 C3 C-| C2 C2- C C3 |",  // Caravan #3 
  "| C3 C- C3 C- | C3 C C2 C2 |",  // Caravan #4
  "| C3 C- C3 C- | C3 C- C4 |",  // Caravan #5
  "| C8- | C3 C C2 C C |",  // Cleopatra #1
  "| C3 C- C2 C2- | C C3 C2 C2|",  // Cleopatra #2
  "| z2 C4 C2- | C C3 C4|",  // Cute #1
  "| z2 C4 C2- | C3 C-C2 C2|",  // Cute #2
  "| z C2 C C C2 C- | C C2 C C C3|",  // fly me #1
  "| z C3 C3 C-| C2 z2 z C z2 |",  // On The Street #1
  "| C6 CC-| C3 C  CCCC |",  // Softly #1
  "| C2 CC- C C2 C- | CCCC- C2 C2 |",  // Softly #2
  "| CCC- C-CC |",  // straigh風 
];

const JAZZ_STANDARDS = [
  "T:All The Things You Are\n| _A|GC2_A G C3||_A8 |",
  "T:Blue Bossa\n| G2||g3 f _e d2 c-|c6 _B2 |",
  "T:Cheryl\n| C G2 A -AEFG | E D2 G dcAG |",
  "T:Confirmation\n| A c2 A _BA (3 EF^F | Gd_BG A^C2 G- |GF |",
  "T:Corcovado\n| z E2 D E D2 E-|E D2 E-E4 |",
  "T:The Girl From Ipanema\n| G3 E ED2G-|G2 EE- EEDG-|G2 |",
  "T:Have You Met Miss Jones\n| F3 D C D2 C- | C8|",
  "T:Hot House\n|_B-||B_BA_A G2 _GF| EF^F_B F2 z|",
  "T:I Love You\n| c2 || c4 _D4- | D4 _B3 A | ^G3 A A4- | A4 |",
  "T:Invitation\n| (3 D2_E2d2 A4- | A2 G_B (3 A2G2C2| D8 |",
  "T:Jor Du\n| z G,CD _EFGE||^F4 =F3 _E |",
  "T:Lullaby of Birdland\n| cc_B_A G F2 D-|D2 F=E- E2 z C-| C2 |",
  "T:Moanin'\n| z F2 F _AAFC || _E2 F2 z4 |" ,
  "T:Ask Me Now\n| cGEC B, B3 | _BFD_B, A, A3 |",
  "T:Bemsha Swing\n|G2|| c2 z2 z2 z G | z c _B_A G2 F2| EE B,2 C2 z2 |",
  "T:Epistrophy\n|z2 ^CD ^A B3 | ^CD^AB-B2 z2 |z2 ^CD _B E3 |^CD_BE-E2 z2 |",
  "T:Eronel\n|dBce-e3 d | F2 FE--E2 z2 |z A (3_B_df _ecde- |e6  z|",
  "T:Well You Needn't\n|B,|| CF A2 c2 AF |_E'_B z2z2 B,|CF A2 c2 AF |_B_G z2z2 |",
  "T:Salt Peanuts\n|z2 F2 fF z2|F2 fF z2 z|"

];

// 現在のモードに応じたデータソースを返すヘルパー関数
const getCurrentPatterns = () => {
    return currentMode === 'rhythm' ? PATTERNS : JAZZ_STANDARDS;
};


/* -------------------------------------------
 *  4. コア機能の関数
 * ------------------------------------------- */
function pickNextIndex() {
  const patterns = getCurrentPatterns();
  let idx = Math.floor(Math.random() * patterns.length);
  if (idx === currentIndex) {
    idx = (idx + 1) % patterns.length;
  }
  return idx;
}

async function renderPattern(abcBody, tempo) {
  if (synth) {
    try { await synth.stop(); } catch (_) {}
    synth = null;
  }
  paperEl.innerHTML = "";
  const abc = header(tempo) + abcBody;
  const tunes = ABCJS.renderAbc("paper", abc, { responsive: "resize" });
  visualObj = tunes && tunes[0] ? tunes[0] : null;

  if (!visualObj) {
    console.error("Failed to render the score.");
    return;
  }
  synth = new ABCJS.synth.CreateSynth();
  
  try {
    await synth.init({
      audioContext: AC,
      visualObj: visualObj,
      options: {
        onEnded: () => {
          if (isPlaying && synth) {
            synth.start({ restart: true });
          }
        },
        chordsOff: true
      }
    });
    await synth.prime();
  } catch (err) {
    console.error("Failed to initialize audio.", err);
  }
}

async function togglePlay() {
  if (!synth || !visualObj) return;

  if (AC.state === "suspended") {
    try { await AC.resume(); } catch (_) {}
  }
  isPlaying = !isPlaying;

  if (isPlaying) {
    playBtn.textContent = "停止 ■";
    try {
      await synth.start();
    } catch (e) {
      console.error("Failed to start playback.", e);
      isPlaying = false;
      playBtn.textContent = "再生 ▶";
    }
  } else {
    playBtn.textContent = "再生 ▶";
    try { await synth.stop(); } catch (_) {}
  }
}

// 「次へ」ボタンのロジックは現在のモードに依存するように
async function showRandomPattern() {
  const wasPlaying = isPlaying;
  isPlaying = false;
  
  currentIndex = pickNextIndex();
  const patterns = getCurrentPatterns();
  await renderPattern(patterns[currentIndex], Number(tempoSlider.value));

  isPlaying = wasPlaying;
  if (isPlaying) {
    togglePlay();
  }
}

// モード切替のコアロジック
function switchMode(newMode) {
    // 同じモードがクリックされた場合は何もしない
    if (newMode === currentMode) return;
    
    currentMode = newMode;
    currentIndex = -1; // インデックスをリセット

    // 再生中であれば停止
    if (isPlaying) {
        togglePlay();
    }

    // ボタンのアクティブ状態を更新
    if (currentMode === 'rhythm') {
        modeRhythmBtn.classList.add('active');
        modeJazzBtn.classList.remove('active');
    } else {
        modeRhythmBtn.classList.remove('active');
        modeJazzBtn.classList.add('active');
    }

    // 新しいモードの最初のパターンを表示
    showRandomPattern();
}


/* -------------------------------------------
 *  5. イベントリスナーの設定
 * ------------------------------------------- */
playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", showRandomPattern);

tempoSlider.addEventListener("input", async () => {
  tempoVal.textContent = tempoSlider.value;
  // テンポ変更時は、現在のモードのまま楽譜を再描画
  const patterns = getCurrentPatterns();
  const wasPlaying = isPlaying;
  isPlaying = false;
  await renderPattern(patterns[currentIndex], Number(tempoSlider.value));
  isPlaying = wasPlaying;
  if (isPlaying) {
    togglePlay();
  }
});

// ★ モード切替ボタンのイベントリスナー
modeRhythmBtn.addEventListener('click', () => switchMode('rhythm'));
modeJazzBtn.addEventListener('click', () => switchMode('jazz'));


/* -------------------------------------------
 *  6. 初期化処理
 * ------------------------------------------- */
window.addEventListener("load", async () => {
  tempoVal.textContent = tempoSlider.value;
  // 初期モード（リズム練習）の最初のパターンを表示
  currentIndex = pickNextIndex();
  await renderPattern(PATTERNS[currentIndex], Number(tempoSlider.value));
});