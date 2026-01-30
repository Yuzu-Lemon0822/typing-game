import { InputHandler } from './main/input.js';
import { Game } from './main/game.js';

window.addEventListener('DOMContentLoaded', () => {
    // インスタンス作成
    // inputHandlerはcallbackを後でgame側からセットする
    const inputHandler = new InputHandler(() => {});
    const game = new Game(inputHandler);

    // ゲーム初期化
    game.init();
});