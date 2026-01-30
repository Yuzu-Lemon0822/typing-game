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
        this.remainingKana = ""; // 未入力のひらがな（例: "しょく"）
        this.targetRomajiOptions = []; // 次に打つべきローマ字の候補リスト
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
        
        this.updateView();
        this.updateValidOptions(); // 最初の文字の有効なローマ字パターンを計算
    }

    // ユーザーの入力を処理
    processInput(key) {
        if (!this.isGaming) {
            if (key === ' ') this.start();
            return;
        }

        // 入力キーが有効なパターンの先頭と一致するかチェック
        // validOptionsは ['sha', 'sya', 'si', 'ci'...] のような配列になっている想定
        // しかし、実際には「s」だけ打った状態で保留することもあるため、
        // 「次の1文字としてありえるもの」を探す
        
        const matchedOption = this.targetRomajiOptions.find(opt => opt.startsWith(key));

        if (matchedOption) {
            // 正解
            this.handleCorrectInput(key, matchedOption);
        } else {
            // 不正解
            this.handleMiss();
        }
    }

    // 「現在のひらがな」から、入力可能なローマ字の全パターンを生成する
    updateValidOptions() {
        if (this.remainingKana.length === 0) return;

        let options = [];

        // 1. 2文字結合パターン (例: しゃ -> sha, sya)
        if (this.remainingKana.length >= 2) {
            const twoChars = this.remainingKana.substring(0, 2);
            if (combinationMap[twoChars]) {
                options.push(...combinationMap[twoChars]);
            }
        }

        // 2. 1文字パターン (例: し -> shi, si)
        const firstChar = this.remainingKana.substring(0, 1);
        if (romajiMap[firstChar]) {
            options.push(...romajiMap[firstChar]);
        }
        
        // 3. 促音（っ）の特例: 次の文字の子音を重ねる
        if (firstChar === 'っ' && this.remainingKana.length >= 2) {
            // 次の文字のローマ字パターンを取得して、その先頭文字をoptionsに追加
            const nextChar = this.remainingKana.substring(1, 2);
            // 結合文字の可能性も考慮（例：っちゃ）
            let nextOptions = [];
            if (this.remainingKana.length >= 3) {
                const nextTwo = this.remainingKana.substring(1, 3);
                if (combinationMap[nextTwo]) nextOptions.push(...combinationMap[nextTwo]);
            }
            if (romajiMap[nextChar]) nextOptions.push(...romajiMap[nextChar]);
            
            // 次の文字の子音(最初の文字)だけを取り出して追加
            nextOptions.forEach(opt => {
                const consonant = opt.charAt(0);
                if (consonant.match(/[a-z]/) && consonant !== 'a' && consonant !== 'i' && consonant !== 'u' && consonant !== 'e' && consonant !== 'o') {
                    options.push(consonant); // 'tt' の最初の 't' だけ有効とする
                }
            });
            // 単独の「xtu」「ltu」もromajiMapに含まれているので上記2.で追加済み
        }

        // 4. 「ん」の特例 (n, nn, n')
        if (firstChar === 'ん') {
            // 次が母音やナ行なら nn 必須だが、ここは簡易的に n, nn どちらも候補に入れて、
            // 入力処理側で「n」が打たれた後の判定を制御するのが理想。
            // 今回はシンプルに romajiMap['ん'] の候補を使う。
        }

        this.targetRomajiOptions = options;
    }

    handleCorrectInput(key, matchedFullString) {
        this.typedRomaji += key;

        // 候補リストを更新：今打ったキーの分だけ候補の文字を削る
        // 例: 候補['sha', 'sya'] で 's' を打った -> 新候補 ['ha', 'ya']
        this.targetRomajiOptions = this.targetRomajiOptions
            .filter(opt => opt.startsWith(key))
            .map(opt => opt.substring(1));

        // もし候補の中に「空文字」があれば、それは1つのひらがな（または結合文字）の入力完了を意味する
        // 例: 'ha' から 'h', 'a' と打って '' になった場合
        if (this.targetRomajiOptions.includes("")) {
            this.advanceCursor();
        }

        this.updateView();
    }

    // ひらがなを1単位進める処理
    advanceCursor() {
        // 何文字分のひらがなを消化したか判定する必要がある
        // シンプルにするため、updateValidOptionsでチェックしたロジックを逆算する
        // (厳密にはどのルートを通ったか保持すべきだが、ここでは簡易的に最長一致などで処理)
        
        let consumed = 0;
        
        // 2文字結合だったか？
        const twoChars = this.remainingKana.substring(0, 2);
        const oneChar = this.remainingKana.substring(0, 1);

        // 完了したということは、targetRomajiOptionsに "" が含まれている状態。
        // ここで「何文字減らすか」は、厳密には「ユーザーが選んだローマ字」に対応するひらがな文字数。
        // しかしコードが複雑になりすぎるので、ここでは「今のremainingKana」に対して
        // 「最もありそうな文字数」を削除する。
        
        // 簡易ロジック:
        // 結合文字マップにあり、かつユーザーが打ったローマ字列がそれに対応するなら2文字消費
        // そうでなければ1文字消費
        // (※促音「っ」の「t」打ちだけの場合は、1文字消費してローマ字残りは維持しないといけない特殊ケースだが、
        //  ここでは「っ」入力完了(=xtuなど)以外に、後続子音入力完了パターンも考慮が必要)

        // ★今回は実装を簡単にするため、「完全に打ち終わった直前のキー入力」時点で判定する
        
        if (combinationMap[twoChars] && this.matchAny(combinationMap[twoChars], this.lastCompletedRomaji)) {
             consumed = 2;
        } else if (oneChar === 'っ' && this.isSokuonInput) {
             consumed = 1; 
             this.isSokuonInput = false;
        } else {
             consumed = 1;
        }
        
        // ※上記の判定はこのクラス構造だと少し難しいので、
        // 「残りの文字列」を再計算するアプローチをとる。
        
        // 修正アプローチ: 
        // ユーザーが打った一連のローマ字が完了した瞬間、
        // それが「どのひらがな」に対応していたかを探す。
        
        // ...チャットでのコード量制限があるため、もっとロバストでシンプルな方法：
        // updateValidOptionsで「このパターンなら何文字消費」という情報を持たせておく。
        
        // 簡易的な再実装:
        // 「targetRomajiOptions」を文字列配列ではなく、オブジェクト配列にする
        // { romaji: 'sha', charCount: 2 }
    }
    
    // ▲ 上記のロジックだと複雑になりすぎるので、メソッドを書き換えてシンプルにします！
    // 正解入力があったら「現在有効な候補」を削っていき、
    // 候補のどれかが空になったら、その候補が持っていた「消費ひらがな数」分だけ進める。

    // 再定義: updateValidOptions
    updateValidOptions() {
        if (this.remainingKana.length === 0) {
            // 全問終了チェックなど
            this.nextQuestion();
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
        if (one === 'っ' && this.remainingKana.length >= 2) {
             const nextChar = this.remainingKana.substring(1, 2);
             // 次の文字の有効なローマ字の先頭文字を取得
             let nextConsonants = [];
             if (romajiMap[nextChar]) {
                 romajiMap[nextChar].forEach(r => nextConsonants.push(r.charAt(0)));
             }
             // 結合文字の場合 (っちゃ -> ttya)
             if (this.remainingKana.length >= 3) {
                 const nextTwo = this.remainingKana.substring(1, 3);
                 if (combinationMap[nextTwo]) {
                     combinationMap[nextTwo].forEach(r => nextConsonants.push(r.charAt(0)));
                 }
             }

             // 母音以外なら追加
             nextConsonants.forEach(c => {
                 if (!['a','i','u','e','o'].includes(c)) {
                     // 「っ」を消費して、残りのローマ字(remaining)は空文字にするわけではない
                     // ここが特殊。「っ」を打ったことにして、次は普通にその文字を打たせる
                     // つまり 「っ」=「t」で消費1。
                     options.push({ remaining: c, consume: 1 });
                 }
             });
        }

        this.targetRomajiOptions = options;
    }

    handleCorrectInput(key, matchedOption) {
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
                    completedOption = newOpt; // 完了したものが見つかった
                } else {
                    nextOptions.push(newOpt);
                }
            }
        }

        if (completedOption) {
            // 文字消化
            this.remainingKana = this.remainingKana.substring(completedOption.consume);
            this.updateValidOptions(); // 新しい文字のために再計算
        } else {
            // まだ途中
            this.targetRomajiOptions = nextOptions;
        }

        this.updateView();
        
        // 全て打ち終わったかチェック
        if (this.remainingKana.length === 0 && this.targetRomajiOptions.length === 0) {
            setTimeout(() => {
                this.currentIndex++;
                this.nextQuestion();
            }, 100);
        }
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
        
        // かな（入力済み部分は色を変えるなどの処理は、この構造だとremainingKanaしか持ってないので
        // 完全な正解ハイライトは難しいが、簡易的に「元のかな」を表示しつつ、
        // remainingKanaに含まれない部分を緑にする）
        const fullKana = this.currentQuestion.kana;
        const typedIndex = fullKana.length - this.remainingKana.length;
        
        const typedPart = fullKana.substring(0, typedIndex);
        const untypedPart = fullKana.substring(typedIndex);
        
        this.kanaEl.innerHTML = `<span class="typed">${typedPart}</span><span class="untyped">${untypedPart}</span>`;

        // ローマ字
        // ユーザーが打った部分 + 次の文字の推奨ローマ字(最初の候補)
        let suggestion = "";
        if (this.targetRomajiOptions.length > 0) {
            // ユーザーが今打っている途中のものがあれば、それを優先表示
            // targetRomajiOptions[0].remaining は「残り」なので、
            // ヘボン式などのデフォルト表示は「データ」から取ってくる方が綺麗だが、
            // ここでは簡易的に「現在の入力候補の残り」を表示する
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
             if(key === ' ') this.init(); // リスタート時はinitから
        };
    }
}