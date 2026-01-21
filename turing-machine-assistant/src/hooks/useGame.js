import { useState } from "react";

class Game {
    constructor(gameId, n) {
        this.gameId = gameId;
        this.rounds = [];
        this.currentRound = 0;
        this.validatorColumns = n;
        this.startGame();
    }

    startGame() {
        this.currentRound = 0;
        this.rounds.push(new Round("000", this.validatorColumns));
    }

    endGame() {
        this.rounds[this.currentRound].editable = false;
        this.rounds[this.currentRound].endTime = new Date();
    }

    startNewRound() {
        const currentRound = this.getCurrentRound();
        if (!currentRound.validator.isValid()) {
            return false;
        }
        currentRound.editable = false;
        currentRound.endTime = new Date();
        this.currentRound += 1;
        this.rounds.push(new Round("000", this.validatorColumns));
        return true;
    }

    getCurrentRound() {
        return this.rounds[this.currentRound];
    }

    getCurrentScore() {
        const rounds = this.rounds.length;
        const validations = this.rounds.reduce((acc, round) => acc + round.validator.membersWithValueCount(), 0);

        return { rounds, validations };
    }
}

class Round {
    constructor(code, n) {
        this.code = code;
        switch (n) {
            case 4:
                this.validator = new Validator(-1, -1, -1, -1);
                break;
            case 5:
                this.validator = new Validator(-1, -1, -1, -1, -1);
                break;
            case 6:
                console.log("Creating validator with 6 columns");
                this.validator = new Validator(-1, -1, -1, -1, -1, -1);
                break;
            default:
                this.validator = new Validator(-1, -1, -1, -1);
        }
        this.editable = true;
        this.startTime = new Date();
        this.endTime = null;
    }

    setCode(newCode) {
        if (this.editable) {
            this.code = newCode;
        }
    }

    setFirstDigit() {
        if (this.editable) {
            var newDigit = (parseInt(this.code[0]) + 1) % 5;
            if (newDigit == 0) newDigit = 5;
            this.code = newDigit.toString() + this.code.slice(1);
        }
    }

    setSecondDigit() {
        if (this.editable) {
            var newDigit = (parseInt(this.code[1]) + 1) % 5;
            if (newDigit == 0) newDigit = 5;
            this.code = this.code[0] + newDigit.toString() + this.code.slice(2);
        }
    }

    setThirdDigit() {
        if (this.editable) {
            var newDigit = (parseInt(this.code[2]) + 1) % 5;
            if (newDigit == 0) newDigit = 5;
            this.code = this.code.slice(0, 2) + newDigit.toString();
        }
    }

    getCode() {
        return this.code;
    }

    getValidations() {
        return this.validator.membersWithValueCount();
    }
}

class Validator {
    // VALIDATOR_MEMBER_STATES 
    //     TRUE: 1,
    //     FALSE: 0,
    //     UNSET: -1,
    //     NOT_PLAYING: null

    constructor(a = -1, b = -1, c = -1, d = -1, e = null, f = null) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
    }

    cycleValue(key) {
        if (this.hasOwnProperty(key)) {
            const currentValue = this[key];
            let newValue;
            switch (currentValue) {
                case -1:
                    newValue = 1;
                    break;
                case 1:
                    newValue = 0;
                    break;
                case 0:
                    newValue = -1;
                    break;
                default:
                    newValue = null;
            }
            this[key] = newValue;

            if (this.membersWithValueCount() > 3) {
                this[key] = currentValue;
            }
        }
    }

    membersWithValueCount() {
        const values = [this.a, this.b, this.c, this.d, this.e, this.f].filter(v => v !== undefined);
        const setValues = values.filter(v => v === 0 || v === 1);
        return setValues.length;
    }

    isValid() {
        const valueCount = this.membersWithValueCount();

        return valueCount > 0 && valueCount <= 3;
    }
}

export const useGame = () => {
    const [game, setGame] = useState(null);
    const [isGameStarted, setIsGameStarted] = useState(false);

    const cloneGame = (gameObj) => {
        const cloned = JSON.parse(JSON.stringify(gameObj));
        Object.setPrototypeOf(cloned, Game.prototype);
        cloned.rounds.forEach(round => {
            Object.setPrototypeOf(round, Round.prototype);
            Object.setPrototypeOf(round.validator, Validator.prototype);
        });
        return cloned;
    };

    const startGame = (gameId, n) => {
        setIsGameStarted(true);
        setGame(new Game(gameId, n));
    };


    const endGame = () => {
        game.endGame();
        setGame(cloneGame(game));
        setIsGameStarted(false);
    };

    const startNewRound = () => {
        if (game.getCurrentRound().code.includes("0")) return;

        const roundStarted = game.startNewRound();
        if (roundStarted) {
            setGame(cloneGame(game));
        }
    };

    const changeDigit = (digitIndex) => {
        const currentRound = game.getCurrentRound();
        switch (digitIndex) {
            case 0:
                currentRound.setFirstDigit();
                break;
            case 1:
                currentRound.setSecondDigit();
                break;
            case 2:
                currentRound.setThirdDigit();
                break;
        }

        setGame(cloneGame(game));
    }

    const changeValidator = (validatorKey) => {
        game.getCurrentRound().validator.cycleValue(validatorKey);
        setGame(cloneGame(game));
    }

    return {
        game,
        isGameStarted,
        startGame,
        endGame,
        startNewRound,
        changeDigit,
        changeValidator
    };
};

export { Game, Round, Validator };
