'use client'

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGame } from "@/hooks/useGame";
import CodeInputRow from "@/components/CodeInputRow";
import ValidatorRow from "@/components/ValidatorRow";
import Header from "@/components/Header";

export default function Home() {
  const { game, isGameStarted, startGame, endGame, startNewRound, changeDigit, changeValidator } = useGame();

  useEffect(() => {
    if (game) console.log(game);
  }, [game]);

  const handleStartGame = (n) => {
    startGame(n);
  }

  const handleEndGame = () => {
    endGame();
  }

  const handleNewRound = () => {
    startNewRound();
  }

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);

    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return [
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
      String(milliseconds).padStart(3, "0"),
    ].join(":");
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-start bg-zinc-50 font-sans dark:bg-black">
      <Card className="m-4 p-4">
        <h1 className="text-4xl font-bold text-green-600 uppercase">Turing machine</h1>
        {isGameStarted ?
          <>
          <Header n={game.validatorColumns} />
            {game.rounds.map((round, index) => (
              <div key={index} className={`flex ${index != game.currentRound && 'pointer-events-none opacity-50' }`}>
                <div className="mr-8">
                  <CodeInputRow
                    code={round.code}
                    onDigitOneChange={() => changeDigit(0)}
                    onDigitTwoChange={() => changeDigit(1)}
                    onDigitThreeChange={() => changeDigit(2)}
                  />
                </div>
                <div>
                  <ValidatorRow validator={round.validator} onChange={(key) => changeValidator(key)} />
                </div>
              </div>
            ))}
            <Button variant="outline" size="lg" className="px-16 hover:cursor-pointer" onClick={() => handleNewRound()}>
              New round
            </Button>
            <Button size="lg" className="px-16 hover:cursor-pointer" onClick={() => handleEndGame()}>
              End game
            </Button>
          </>
          :
          <div className="flex justify-between items-center">
            <Button size="lg" className="px-8 mx-4 hover:cursor-pointer" onClick={() => handleStartGame(4)}>
              4
            </Button>
            <Button size="lg" className="px-8 mx-4 hover:cursor-pointer" onClick={() => handleStartGame(5)}>
              5
            </Button>
            <Button size="lg" className="px-8 mx-4 hover:cursor-pointer" onClick={() => handleStartGame(6)}>
              6
            </Button>
          </div>
        }
      </Card >
    </div >
  );
}
