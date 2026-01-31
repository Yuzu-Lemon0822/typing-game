import { questions, romajiMap, combinationMap } from './data.js';

export class Game {
    constructor(inputHandler) {
        this.inputHandler = inputHandler;
        this.questions = [];
        this.currentIndex = 0;
        this.currentQuestion = null;
        
        // 状態管理
        this.isGaming = false;
        
        // 文字列処理用
        this.remainingKana = ""; // 未入力のひらがな
        this.targetRomajiOptions = []; // 次に打つべきローマ字の候補リスト（オブジェクト配列）
        this.typedRomaji = ""; // 画面表示用にユーザーが打ったローマ字を記録
        
        // DOM要素
        this.kanjiEl = document.getElementById('text-kanji');
        this.kanaEl = document.getElementById('text-kana');
        this.romajiEl = document.getElementById('text-romaji');
        this.gameArea = document.getElementById('game-area');
    }

    init() {
        // シャッフルしてセット
        this.questions = [...questions].sort(() => Math.random() - 0.5);
        this.inputHandler.callback = (key) => this.processInput(key);
        this.inputHandler.start();
    }

    start() {
        this.isGaming = true;
        this.currentIndex = 0;
        this.nextQuestion();
    }

    nextQuestion() {
        if (this.currentIndex >= this.questions.length) {
            this.finishGame();
            return;
        }

        this.currentQuestion = this.questions[this.currentIndex];
        this.remainingKana = this.currentQuestion.kana;
        this.typedRomaji = "";
        
        // 最初の文字の有効なローマ字パターンを計算
        this.updateValidOptions(); 
        this.updateView();
    }

    // ユーザーの入力を処理
    processInput(key) {
        if (!this.isGaming) {
            if (key === ' ') this.start();
            return;
        }

        // ▼▼▼ 修正箇所はここ！ ▼▼▼
        // targetRomajiOptions はオブジェクトの配列なので、.remaining プロパティを見る必要があります
        const matchedOption = this.targetRomajiOptions.find(opt => opt.remaining.startsWith(key));

        if (matchedOption) {
            // 正解
            this.handleCorrectInput(key);
        } else {
            // 不正解
            this.handleMiss();
        }
    }

    // 「現在のひらがな」から、入力可能なローマ字の全パターンを生成する
    updateValidOptions() {
        if (this.remainingKana.length === 0) {
            this.targetRomajiOptions = [];
            return;
        }

        let options = []; // { remaining: string, consume: number }

        // 1. 2文字結合 (しゃ)
        if (this.remainingKana.length >= 2) {
            const two = this.remainingKana.substring(0, 2);
            if (combinationMap[two]) {
                combinationMap[two].forEach(r => options.push({ remaining: r, consume: 2 }));
            }
        }

        // 2. 1文字 (あ、っ(xtu))
        const one = this.remainingKana.substring(0, 1);
        if (romajiMap[one]) {
            romajiMap[one].forEach(r => options.push({ remaining: r, consume: 1 }));
        }

        // 3. 促音 (っ + k -> k)
        // 例: 「かっぱ」の「っ」の時、次の「ぱ(pa)」の「p」を受け付ける
        if (one === 'っ' && this.remainingKana.length >= 2) {
             const nextChar = this.remainingKana.substring(1, 2);
             let nextConsonants = [];
             
             // 次が単独文字の場合
             if (romajiMap[nextChar]) {
                 romajiMap[nextChar].forEach(r => nextConsonants.push(r.charAt(0)));
             }
             // 次が結合文字の場合 (例: っちゃ -> ttya)
             if (this.remainingKana.length >= 3) {
                 const nextTwo = this.remainingKana.substring(1, 3);
                 if (combinationMap[nextTwo]) {
                     combinationMap[nextTwo].forEach(r => nextConsonants.push(r.charAt(0)));
                 }
             }

             // 母音(a,i,u,e,o)以外なら「っ」の入力として有効とする
             // 重複を除去しつつ追加
             const uniqueConsonants = [...new Set(nextConsonants)];
             uniqueConsonants.forEach(c => {
                 if (!['a','i','u','e','o'].includes(c)) {
                     // 促音入力(ttなど)は1文字消費扱い
                     options.push({ remaining: c, consume: 1 });
                 }
             });
        }

        this.targetRomajiOptions = options;
    }

    handleCorrectInput(key) {
        this.typedRomaji += key;

        // 候補全体をフィルタリング＆更新
        // 今回打ったキーで始まるものだけ残し、そのキー文字を削る
        let nextOptions = [];
        let completedOption = null;

        for (let opt of this.targetRomajiOptions) {
            if (opt.remaining.startsWith(key)) {
                let newRem = opt.remaining.substring(1);
                let newOpt = { remaining: newRem, consume: opt.consume };
                
                if (newRem === "") {
                    // どれか1つのルートで入力が完了した
                    // (優先度などは配列順序に依存するが、完了したものを優先採用)
                    if (!completedOption) completedOption = newOpt;
                } else {
                    nextOptions.push(newOpt);
                }
            }
        }

        if (completedOption) {
            // 文字消化 (ひらがなを進める)
            this.remainingKana = this.remainingKana.substring(completedOption.consume);
            
            // 全問終了チェック
            if (this.remainingKana.length === 0) {
                // 問題終了。少し待って次へ
                this.updateView(); // 最後の一文字を表示反映させるため
                setTimeout(() => {
                    this.currentIndex++;
                    this.nextQuestion();
                }, 100);
                return; // ここで終わる
            } else {
                // 次の文字のために再計算
                this.updateValidOptions(); 
            }
        } else {
            // まだ途中（sh -> sha の s を打った段階など）
            this.targetRomajiOptions = nextOptions;
        }

        this.updateView();
    }

    handleMiss() {
        this.gameArea.classList.remove('shake');
        this.gameArea.classList.remove('error-bg');
        
        // リフローさせてアニメーションを再起動
        void this.gameArea.offsetWidth;
        
        this.gameArea.classList.add('shake');
        this.gameArea.classList.add('error-bg');
        
        setTimeout(() => {
            this.gameArea.classList.remove('error-bg');
        }, 100);
    }

    updateView() {
        if (!this.currentQuestion) return;

        // 漢字
        this.kanjiEl.textContent = this.currentQuestion.kanji;
        
        // かな
        const fullKana = this.currentQuestion.kana;
        // remainingKanaは減っていくので、全体長 - 残り長 = 入力済み長
        const typedIndex = fullKana.length - this.remainingKana.length;
        
        const typedPart = fullKana.substring(0, typedIndex);
        const untypedPart = fullKana.substring(typedIndex);
        
        this.kanaEl.innerHTML = `<span class="typed">${typedPart}</span><span class="untyped">${untypedPart}</span>`;

        // ローマ字
        // 次に打つべきローマ字のヒント表示
        let suggestion = "";
        if (this.targetRomajiOptions.length > 0) {
            // 候補の中で一番短いもの、あるいは最初のものをヒントとして出す
            suggestion = this.targetRomajiOptions[0].remaining;
        }
        
        this.romajiEl.innerHTML = `<span class="typed">${this.typedRomaji}</span><span class="untyped" style="opacity:0.5">${suggestion}</span>`;
    }

    finishGame() {
        this.isGaming = false;
        this.kanjiEl.textContent = "Game Clear!";
        this.kanaEl.textContent = "";
        this.romajiEl.textContent = "Press Space to Restart";
        this.inputHandler.callback = (key) => {
             if(key === ' ') this.init();
        };
    }
}
