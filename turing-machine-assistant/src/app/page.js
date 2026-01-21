'use client'

import { useState, useMemo } from "react";
import Image from "next/image";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGame } from "@/hooks/useGame";
import CodeInputRow from "@/components/CodeInputRow";
import ValidatorRow from "@/components/ValidatorRow";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import CodeHelper from "@/components/CodeHelper";

export default function Home() {
  const { game, isGameStarted, startGame, endGame, startNewRound, changeDigit, changeValidator } = useGame();

  const [gameId, setGameId] = useState("");
  const [helperExcluded, setHelperExcluded] = useState({
    blue: new Set(),
    yellow: new Set(),
    purple: new Set(),
  });

  const score = useMemo(() => {
    if (!game) return 0;
    return game.getCurrentScore();
  }, [game]);

  const handleStartGame = (n) => {
    if (gameId.length < 5) return;

    startGame(gameId, n);
    setHelperExcluded({
      blue: new Set(),
      yellow: new Set(),
      purple: new Set(),
    });
  }

  const handleEndGame = () => {
    endGame();
  }

  const handleNewRound = () => {
    startNewRound();
  }

  const handleInput = (e) => {
    if (e.target.value.length > 12) return;

    setGameId('#' + e.target.value.toUpperCase());
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

  return <>
    <div className="p-2 md:p-4 flex flex-col min-h-screen w-full items-center justify-start bg-zinc-50 font-sans dark:bg-black">
      <Card className="p-4 w-full max-w-lg">
        <div className="flex justify-center">
          <Image src="/title.png" alt="Turing Machine" width={150} height={100} />
        </div>
        {isGameStarted ?
          <>
            <Tabs defaultValue="game" className="w-full">
              <TabsList>
                <TabsTrigger value="game">Game</TabsTrigger>
                <TabsTrigger value="helper">Helper</TabsTrigger>
              </TabsList>
              <TabsContent value="game">
                <div className="w-full flex flex-col gap-2">
                  <Card className="px-4 py-2 mb-4">
                    <div className="w-full flex justify-between items-center">
                      <span className="font-semibold text-lg text-center">{gameId}</span>
                      <span className="font-semibold text-lg text-center">Score: {score.rounds} - {score.validations}</span>
                    </div>
                  </Card>
                  <Header n={game.validatorColumns} />
                  {game.rounds.map((round, index) => (
                    <div key={index} className={`flex justify-between ${index != game.currentRound && 'pointer-events-none opacity-50'}`}>
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
                  <Button size="lg" className="px-16 mt-4 hover:cursor-pointer" onClick={() => handleNewRound()}>
                    New round
                  </Button>
                  <Button variant="outline" size="lg" className="px-16 hover:cursor-pointer" onClick={() => handleEndGame()}>
                    End game
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="helper">
                <div className="w-full flex flex-col gap-2">
                  <CodeHelper excluded={helperExcluded} setExcluded={setHelperExcluded} />
                </div>
              </TabsContent>
            </Tabs>
          </>
          :
          <>
            <Input type="text" placeholder="Game ID" id="gameIdInput"
              className="text-center text-xl font-bold uppercase" onChange={(e) => handleInput(e)} />
            <div className="text-center">Select number of validator columns</div>
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
          </>
        }
      </Card >
    </div >
  </>
}
