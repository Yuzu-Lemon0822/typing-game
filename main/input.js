export class InputHandler {
    constructor(callback) {
        this.callback = callback;
        this.boundHandler = this.handleKeyDown.bind(this);
    }

    start() {
        document.addEventListener('keydown', this.boundHandler);
    }

    stop() {
        document.removeEventListener('keydown', this.boundHandler);
    }

    handleKeyDown(event) {
        // ShiftやCtrlなどの修飾キー単体は無視
        if (event.key.length > 1) return;
        
        // 入力された文字を小文字にしてコールバックに渡す
        this.callback(event.key.toLowerCase());
    }
}