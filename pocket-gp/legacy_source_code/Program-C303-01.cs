using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Threading;
using System.IO;
using System.ComponentModel;
using System.Windows.Threading;

namespace Pause_Resume
{
    class Program
    {
        static bool exit = false;
        //------------------------------------------------------------------------
        static Random rGen = new Random();
        //------------------------------------------------------------------------
        static Driver playerDriver = new Driver();
        static int choosenPilotIndex = -1;
        static int choosenTyreIndex = 0;
        static string[] tyres = new string[5] { "s", "m", "h", "i", "w" };
        static bool reversedQualy = false;
        //------------------------------------------------------------------------
        static Tracks currentCircuit;
        static int choosenTrackIndex = -1;
        //------------------------------------------------------------------------
        static int[] rainOnTrack;
        static int[] waterOnTrack;
        //------------------------------------------------------------------------
        static ConsoleColor[] allColors = Enum.GetValues(typeof(ConsoleColor)).Cast<ConsoleColor>().ToArray();
        static ConsoleColor[] normalColors = new ConsoleColor[6] { ConsoleColor.Blue, ConsoleColor.Green, ConsoleColor.Red, ConsoleColor.Magenta, ConsoleColor.Yellow, ConsoleColor.Gray };
        static ConsoleColor[] darkColors = new ConsoleColor[6] { ConsoleColor.DarkBlue, ConsoleColor.DarkGreen, ConsoleColor.DarkRed,
                                                                    ConsoleColor.DarkMagenta, ConsoleColor.DarkYellow, ConsoleColor.DarkGray };
        static int choosenHighlightColorIndex = 12;
        static int choosenPlayerColorIndex = 10;
        static int choosenPitWindowColorIndex = 3;
        //------------------------------------------------------------------------
        static List<Driver> Drivers = new List<Driver>();
        static List<Championship> Championship = new List<Championship>();
        static List<Tracks> Circuits = new List<Tracks>();
        //------------------------------------------------------------------------
        static List<Options> MainMenuOptions;
        static List<Options> PreRaceMenuOptions;
        static List<Options> RaceManagementMenuOptions;
        static List<Options> ChampionshipMenuOptions;
        static List<Options> PreferencesMenuOptions;
        static List<Options> CarSetupMenuOptions;

        ///---------------------------------------------------------------------------------------------------------------------

        static void Main(string[] args)
        {
            Console.SetWindowSize(Console.LargestWindowWidth - 70, Console.LargestWindowHeight - 10);
            Console.CursorVisible = false;

            // Load main menu
            MainMenu();
        }
        //----------Loading data from txt files--------------------------------------------------------------
        static void LoadFiles()
        {
            StreamReader sr = new StreamReader("RealisticGrid_2021.csv");
            sr.ReadLine();
            while (!sr.EndOfStream)
            {
                Drivers.Add(new Driver(sr.ReadLine()));

            }
            sr.Close();

            StreamReader sr2 = new StreamReader("Championship.csv");
            sr2.ReadLine();
            while (!sr2.EndOfStream)
            {
                Championship.Add(new Championship(sr2.ReadLine()));
            }
            sr2.Close();

            StreamReader sr3 = new StreamReader("Tracks.csv");
            sr3.ReadLine();
            while (!sr3.EndOfStream)
            {
                Circuits.Add(new Tracks(sr3.ReadLine()));
            }
            sr3.Close();

        }
        //----------Menus--------------------------------------------------------------
        static void MainMenu()
        {
            exit = false;

            // Load grid
            LoadFiles();

            // Create options that you want your menu to have
            MainMenuOptions = new List<Options>
            {
                new Options("Start race", () => RaceSetup()),
                new Options("Driver: -",() => ChoosePilot()),
                new Options("Track: Random",() => ChooseTrack()),
                new Options("Championship Table",() => ChampionshipMenu()),
                new Options("Preferences",() => PreferencesMenu()),
                //new Options("Reversed Grid: ", () =>  ),
                new Options("Exit", () => exit = true),
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteMenu(MainMenuOptions, MainMenuOptions[index]);

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < MainMenuOptions.Count)
                    {
                        index++;
                        WriteMenu(MainMenuOptions, MainMenuOptions[index]);
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteMenu(MainMenuOptions, MainMenuOptions[index]);
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    MainMenuOptions[index].Selected.Invoke();
                    //index = 0;
                }
            }
            while (exit != true);
        }
        static void PreRaceMenu()
        {
            // Exit pre race menu or not
            exit = false;

            // Create options that you want your menu to have
            PreRaceMenuOptions = new List<Options>
            {
                // Select tyre for player
                new Options("Select tyre: s", () => SelectTyrePlayer()),
                new Options("Qualy type: Normal",() => SelectQualy()),
                new Options("Setup",() => CarSetupMenu()),
                new Options("Start race", () => exit = true)
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteMenu(PreRaceMenuOptions, PreRaceMenuOptions[index]);
                WriteTrackInfo();
                WriteWeather();

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < PreRaceMenuOptions.Count)
                    {
                        index++;
                        WriteMenu(PreRaceMenuOptions, PreRaceMenuOptions[index]);
                        WriteTrackInfo();
                        WriteWeather();
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteMenu(PreRaceMenuOptions, PreRaceMenuOptions[index]);
                        WriteTrackInfo();
                        WriteWeather();
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    PreRaceMenuOptions[index].Selected.Invoke();
                    WriteTrackInfo();
                    WriteWeather();
                    //index = 0;
                }
            }
            while (exit != true);
        }
        static void RaceManagementMenu()
        {
            // Exit race management menu or not
            exit = false;

            // Simulate first lap
            OneLapSimulate();

            // Create options that you want your menu to have
            RaceManagementMenuOptions = new List<Options>
            {
                //Simulate next lap
                new Options("Continue",() => OneLapSimulate()),
                // Select next tyre for player
                new Options("Select tyre: s", () => SelectTyrePlayerMidRace()),
                // Confirm choice (commit to pitstop)
                new Options("Confirm pitstop", () => PitStop())
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteRaceMenu(RaceManagementMenuOptions, RaceManagementMenuOptions[index]);
                WriteWeather();

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < RaceManagementMenuOptions.Count)
                    {
                        index++;
                        WriteRaceMenu(RaceManagementMenuOptions, RaceManagementMenuOptions[index]);
                        WriteWeather();
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteRaceMenu(RaceManagementMenuOptions, RaceManagementMenuOptions[index]);
                        WriteWeather();
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    RaceManagementMenuOptions[index].Selected.Invoke();
                    WriteWeather();
                    //index = 0;
                }
            }
            while (exit != true);
        }
        static void ChampionshipMenu()
        {
            // Exit pre race menu or not
            exit = false;

            // Create options that you want your menu to have
            ChampionshipMenuOptions = new List<Options>
            {
                // Select tyre for player
                new Options("Reset championship", () => ResetChampionship()),
                new Options("Back", () => exit = true)
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteChampionshipMenu(ChampionshipMenuOptions, ChampionshipMenuOptions[index]);

                //Display Table
                ShowChampionshipTable();

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < ChampionshipMenuOptions.Count)
                    {
                        index++;
                        WriteChampionshipMenu(ChampionshipMenuOptions, ChampionshipMenuOptions[index]);
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteChampionshipMenu(ChampionshipMenuOptions, ChampionshipMenuOptions[index]);
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    ChampionshipMenuOptions[index].Selected.Invoke();
                    //index = 0;
                }
            }
            while (exit != true);

            exit = false;
        }
        static void PreferencesMenu()
        {
            // Exit pre race menu or not
            exit = false;

            // Create options that you want your menu to have
            PreferencesMenuOptions = new List<Options>
            {
                // Select tyre for player
                new Options(String.Format("Main highlight color: {0}", allColors[choosenHighlightColorIndex].ToString()), () => SelectHighlightColor()),
                new Options(String.Format("Player color: {0}", allColors[choosenPlayerColorIndex].ToString()), () => SelectPlayerColor()),
                new Options(String.Format("Pit window indicator color: {0}", normalColors[choosenPitWindowColorIndex].ToString()), () => SelectPitWindowColor()),
                new Options("Back", () => exit = true)
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[index]);

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < PreferencesMenuOptions.Count)
                    {
                        index++;
                        WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[index]);
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[index]);
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    PreferencesMenuOptions[index].Selected.Invoke();
                    //index = 0;
                }
            }
            while (exit != true);

            exit = false;
        }
        static void CarSetupMenu()
        {
            // Exit pre race menu or not
            exit = false;

            // Create options that you want your menu to have
            CarSetupMenuOptions = new List<Options>
            {
                // Select tyre for player
                new Options(String.Format("Front wing angle: {0}", playerDriver.frontWing), () => SetFrontWingAngle()),
                new Options(String.Format("Rear wing angle: {0}", playerDriver.rearWing), () => SetRearWingAngle()),
                new Options(String.Format("Front suspensions: {0}", playerDriver.frontSuspension), () => SetFrontSuspension()),
                new Options(String.Format("Rear suspensions: {0}", playerDriver.rearSuspension), () => SetRearSuspension()),
                new Options(String.Format("Front ride height: {0}", playerDriver.frontSuspension), () => SetFrontRideHeight()),
                new Options(String.Format("Rear ride height: {0}", playerDriver.rearSuspension), () => SetRearRideHeight()),
                new Options(String.Format("Brake pressure: {0}", playerDriver.brakePressure), () => SetBrakePressure()),
                new Options(String.Format("Front brake bias: {0}", playerDriver.frontBrakeBias), () => SetFrontBrakeBias()),
                new Options(String.Format("Front tyre pressure: {0}", playerDriver.frontTyrePressure), () => SetFrontTyrePressure()),
                new Options(String.Format("Rear tyre pressure: {0}", playerDriver.rearTyrePressure), () => SetRearTyrePressure()),
                new Options("Confirm", () => exit = true)
            };

            // Set the default index of the selected item to be the first
            int index = 0;

            // Store key info in here
            ConsoleKeyInfo keyinfo;
            do
            {
                // Write the menu out
                WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[index]);

                keyinfo = Console.ReadKey();

                // Handle each key input (down arrow will write the menu again with a different selected item)
                if (keyinfo.Key == ConsoleKey.DownArrow)
                {
                    if (index + 1 < CarSetupMenuOptions.Count)
                    {
                        index++;
                        WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[index]);
                    }
                }
                if (keyinfo.Key == ConsoleKey.UpArrow)
                {
                    if (index - 1 >= 0)
                    {
                        index--;
                        WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[index]);
                    }
                }
                // Handle different action for the option
                if (keyinfo.Key == ConsoleKey.Enter)
                {
                    CarSetupMenuOptions[index].Selected.Invoke();
                    //index = 0;
                }
            }
            while (exit != true);

            exit = false;
        }
        //----------Choose pilot in main menu--------------------------------------------------------------
        static void ChoosePilot()
        {
            // Refresh menu with correct value
            if (choosenPilotIndex == Drivers.Count - 1)
            {
                MainMenuOptions[1] = new Options(string.Format("Driver: {0}", "-"), () => ChoosePilot());
                choosenPilotIndex = -1;
            }
            else if (choosenPilotIndex == -1)
            {
                choosenPilotIndex = 0;
                MainMenuOptions[1] = new Options(string.Format("Driver: {0}", Drivers[choosenPilotIndex].name), () => ChoosePilot());
            }
            else
            {
                choosenPilotIndex++;
                MainMenuOptions[1] = new Options(string.Format("Driver: {0}", Drivers[choosenPilotIndex].name), () => ChoosePilot());
            }

            // Write the menu out
            WriteMenu(MainMenuOptions, MainMenuOptions[1]);

        }
        static void ChooseTrack()
        {
            // Refresh menu with correct value
            if (choosenTrackIndex == Circuits.Count - 1)
            {
                MainMenuOptions[2] = new Options(string.Format("Circuit: {0}", "Random"), () => ChooseTrack());
                choosenTrackIndex = -1;
            }
            else if (choosenTrackIndex == -1)
            {
                choosenTrackIndex = 0;
                MainMenuOptions[2] = new Options(string.Format("Circuit: {0}", Circuits[choosenTrackIndex].location), () => ChooseTrack());
            }
            else
            {
                choosenTrackIndex++;
                MainMenuOptions[2] = new Options(string.Format("Circuit: {0}", Circuits[choosenTrackIndex].location), () => ChooseTrack());
            }

            // Write the menu out
            WriteMenu(MainMenuOptions, MainMenuOptions[2]);
        }
        //----------Set compound, qualy type--------------------------------------------------------------
        static void RaceSetup()
        {
            Console.Clear();

            // Setting players character
            if (choosenPilotIndex != -1)
            {
                playerDriver = Drivers[choosenPilotIndex];
            }

            // Setting track
            if (choosenTrackIndex != -1)
            {
                currentCircuit = Circuits[choosenTrackIndex];
                /*numberOfLaps = Circuits[choosenTrackIndex].laps;
                opt = Circuits[choosenTrackIndex].optLapTime;
                ovtkMultiplier = Circuits[choosenTrackIndex].ovtkMultiplier;*/
            }
            else
            {
                int melyikPalya = rGen.Next(1, Circuits.Count + 1);
                foreach (var item in Circuits)
                {
                    if (item.ID == melyikPalya)
                    {
                        currentCircuit = item;
                        /*numberOfLaps = item.laps;
                        opt = item.optLapTime;
                        ovtkMultiplier = item.ovtkMultiplier;*/
                    }
                }
            }

            // Calculating weather for the race
            CalculateRainStuff();

            // Show pre-race menu
            PreRaceMenu();

            // Set choosen tyre to player
            foreach (var driver in Drivers)
            {
                if (driver.name == playerDriver.name)
                {
                    driver.tyreType = tyres[choosenTyreIndex];
                    driver.allTyres += tyres[choosenTyreIndex];
                }
            }

            // Select the tyre for bots
            SelectTyreBots();

            // Make the setup for bots
            BotSetup();

            if (!reversedQualy)
            {
                // Simualte normal qualy
                Console.Clear();
                Console.WriteLine();
                QualyNormal();
            }
            else
            {
                // Simulate reversed qualy
                Console.Clear();
                Console.WriteLine();
                QualyReversed();
            }

            string message = " ...Press any key to start race... ";
            WriteMessageCenter(message, Console.WindowHeight - 3);

            Console.ReadKey();
            Console.Clear();

            // ...Gameplay... (or simulation)
            RaceManagementMenu();

            exit = false;
            Console.Clear();
        }
        //----------Car setup Actions-------------------------------------------------------------------
        static void SetFrontWingAngle()
        {
            // Refresh menu with correct value
            if (playerDriver.frontWing == 10)
            {
                playerDriver.frontWing = 1;
                CarSetupMenuOptions[0] = new Options(String.Format("Front wing angle: {0}", playerDriver.frontWing), () => SetFrontWingAngle());
            }
            else
            {
                playerDriver.frontWing++;
                CarSetupMenuOptions[0] = new Options(String.Format("Front wing angle: {0}", playerDriver.frontWing), () => SetFrontWingAngle());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[0]);
        }
        static void SetRearWingAngle()
        {
            // Refresh menu with correct value
            if (playerDriver.rearWing == 10)
            {
                playerDriver.rearWing = 1;
                CarSetupMenuOptions[1] = new Options(String.Format("Rear wing angle: {0}", playerDriver.rearWing), () => SetRearWingAngle());
            }
            else
            {
                playerDriver.rearWing++;
                CarSetupMenuOptions[1] = new Options(String.Format("Rear wing angle: {0}", playerDriver.rearWing), () => SetRearWingAngle());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[1]);
        }
        static void SetFrontSuspension()
        {
            // Refresh menu with correct value
            if (playerDriver.frontSuspension == 10)
            {
                playerDriver.frontSuspension = 1;
                CarSetupMenuOptions[2] = new Options(String.Format("Front suspensinons: {0}", playerDriver.frontSuspension), () => SetFrontSuspension());
            }
            else
            {
                playerDriver.frontSuspension++;
                CarSetupMenuOptions[2] = new Options(String.Format("Front suspensions: {0}", playerDriver.frontSuspension), () => SetFrontSuspension());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[2]);
        }
        static void SetRearSuspension()
        {
            // Refresh menu with correct value
            if (playerDriver.rearSuspension == 10)
            {
                playerDriver.rearSuspension = 1;
                CarSetupMenuOptions[3] = new Options(String.Format("Rear suspensions: {0}", playerDriver.rearSuspension), () => SetRearSuspension());
            }
            else
            {
                playerDriver.rearSuspension++;
                CarSetupMenuOptions[3] = new Options(String.Format("Rear suspensions: {0}", playerDriver.rearSuspension), () => SetRearSuspension());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[3]);
        }
        static void SetFrontRideHeight()
        {
            // Refresh menu with correct value
            if (playerDriver.frontRideHeight == 10)
            {
                playerDriver.frontRideHeight = 1;
                CarSetupMenuOptions[4] = new Options(String.Format("Front suspensinons: {0}", playerDriver.frontRideHeight), () => SetFrontRideHeight());
            }
            else
            {
                playerDriver.frontRideHeight++;
                CarSetupMenuOptions[4] = new Options(String.Format("Front suspensions: {0}", playerDriver.frontRideHeight), () => SetFrontRideHeight());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[4]);
        }
        static void SetRearRideHeight()
        {
            // Refresh menu with correct value
            if (playerDriver.rearRideHeight == 10)
            {
                playerDriver.rearRideHeight = 1;
                CarSetupMenuOptions[5] = new Options(String.Format("Rear suspensions: {0}", playerDriver.rearRideHeight), () => SetRearRideHeight());
            }
            else
            {
                playerDriver.rearRideHeight++;
                CarSetupMenuOptions[5] = new Options(String.Format("Rear suspensions: {0}", playerDriver.rearRideHeight), () => SetRearRideHeight());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[5]);
        }
        static void SetBrakePressure()
        {
            // Refresh menu with correct value
            if (playerDriver.brakePressure == 10)
            {
                playerDriver.brakePressure = 1;
                CarSetupMenuOptions[6] = new Options(String.Format("Brake pressure: {0}", playerDriver.brakePressure), () => SetBrakePressure());
            }
            else
            {
                playerDriver.brakePressure++;
                CarSetupMenuOptions[6] = new Options(String.Format("Brake pressure: {0}", playerDriver.brakePressure), () => SetBrakePressure());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[6]);
        }
        static void SetFrontBrakeBias()
        {
            // Refresh menu with correct value
            if (playerDriver.frontBrakeBias == 10)
            {
                playerDriver.frontBrakeBias = 1;
                CarSetupMenuOptions[7] = new Options(String.Format("Front brake bias: {0}", playerDriver.frontBrakeBias), () => SetFrontBrakeBias());
            }
            else
            {
                playerDriver.frontBrakeBias++;
                CarSetupMenuOptions[7] = new Options(String.Format("Front brake bias: {0}", playerDriver.frontBrakeBias), () => SetFrontBrakeBias());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[7]);
        }
        static void SetFrontTyrePressure()
        {
            // Refresh menu with correct value
            if (playerDriver.frontTyrePressure == 10)
            {
                playerDriver.frontTyrePressure = 1;
                CarSetupMenuOptions[8] = new Options(String.Format("Front tyre pressure: {0}", playerDriver.frontTyrePressure), () => SetFrontTyrePressure());
            }
            else
            {
                playerDriver.frontTyrePressure++;
                CarSetupMenuOptions[8] = new Options(String.Format("Front tyre pressure: {0}", playerDriver.frontTyrePressure), () => SetFrontTyrePressure());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[8]);
        }
        static void SetRearTyrePressure()
        {
            // Refresh menu with correct value
            if (playerDriver.rearTyrePressure == 10)
            {
                playerDriver.rearTyrePressure = 1;
                CarSetupMenuOptions[9] = new Options(String.Format("Rear tyre pressure: {0}", playerDriver.rearTyrePressure), () => SetRearTyrePressure());
            }
            else
            {
                playerDriver.rearTyrePressure++;
                CarSetupMenuOptions[9] = new Options(String.Format("Rear tyre pressure: {0}", playerDriver.rearTyrePressure), () => SetRearTyrePressure());
            }

            // Write the menu out
            WriteMenu(CarSetupMenuOptions, CarSetupMenuOptions[9]);
        }
        static void BotSetup()
        {
            foreach (var driversCar in Drivers)
            {
                //--> DownForce = (wings + rideheights)
                //--> CarBalance = (rearW - frontW) + (rearRH - frontRH) + (frontsusp + rearSusp)
                //--> Traction = (wings - tyrePressures) + rearSusp
                //--> BreakBalance = (breakPress - frontBbias) - frontSusp
                //--> TopSpeed = (60-(wings+tyrePressures+rideheights))

                #region Downforce

                int humanFactor = rGen.Next(-5,6);
                int target = currentCircuit.optDownForce + humanFactor;
                int attempts = 1;

                do
                {
                    driversCar.frontWing = rGen.Next(1,11);
                    driversCar.rearWing = rGen.Next(1,11);

                    driversCar.frontRideHeight = rGen.Next(1,11);
                    driversCar.rearRideHeight = rGen.Next(1,11);

                    attempts++;

                } while ((driversCar.frontWing+driversCar.rearWing+driversCar.frontRideHeight+driversCar.rearRideHeight) != target && attempts != 50);

                #endregion

                #region Car balance

                humanFactor = rGen.Next(-5, 6);
                target = currentCircuit.optCarBalance + humanFactor;
                attempts = 1;

                do
                {
                    driversCar.frontWing = rGen.Next(1, 11);
                    driversCar.rearWing = rGen.Next(1, 11);

                    driversCar.frontRideHeight = rGen.Next(1, 11);
                    driversCar.rearRideHeight = rGen.Next(1, 11);

                    driversCar.frontSuspension = rGen.Next(1, 11);
                    driversCar.rearSuspension = rGen.Next(1, 11);

                    attempts++;

                } while ((driversCar.rearWing - driversCar.frontWing) + (driversCar.rearRideHeight - driversCar.frontRideHeight) + (driversCar.frontSuspension + driversCar.rearSuspension) != target && attempts != 50);

                #endregion

                #region Traction

                humanFactor = rGen.Next(-5, 6);
                target = currentCircuit.optTraction + humanFactor;
                attempts = 1;

                do
                {
                    driversCar.frontWing = rGen.Next(1, 11);
                    driversCar.rearWing = rGen.Next(1, 11);

                    driversCar.frontSuspension = rGen.Next(1, 11);
                    driversCar.rearSuspension = rGen.Next(1, 11);

                    attempts++;

                } while ((((driversCar.frontWing + driversCar.rearWing) - (driversCar.frontTyrePressure + driversCar.rearTyrePressure)) + driversCar.rearSuspension) != target && attempts != 50);

                #endregion

                #region Break balance

                humanFactor = rGen.Next(-5, 6);
                target = currentCircuit.optTraction + humanFactor;
                attempts = 1;

                do
                {
                    driversCar.brakePressure = rGen.Next(1, 11);
                    driversCar.frontBrakeBias = rGen.Next(1, 11);

                    driversCar.frontSuspension = rGen.Next(1, 11);

                    attempts++;

                } while (((driversCar.brakePressure - driversCar.frontBrakeBias) - driversCar.frontSuspension) != target && attempts != 50);

                #endregion

                #region Top speed

                humanFactor = rGen.Next(-5, 6);
                target = currentCircuit.optTraction + humanFactor;
                attempts = 1;

                do
                {
                    driversCar.frontWing = rGen.Next(1, 11);
                    driversCar.rearWing = rGen.Next(1, 11);

                    driversCar.frontRideHeight = rGen.Next(1, 11);
                    driversCar.rearRideHeight = rGen.Next(1, 11);

                    driversCar.frontTyrePressure = rGen.Next(1, 11);
                    driversCar.rearTyrePressure = rGen.Next(1, 11);

                    attempts++;

                } while ((60 - ((driversCar.frontWing + driversCar.rearWing) + (driversCar.frontTyrePressure + driversCar.rearTyrePressure) + (driversCar.frontRideHeight + driversCar.rearRideHeight))) != target && attempts != 50);

                #endregion
            }
        }
        //----------Weather--------------------------------------------------------------
        static void CalculateRainStuff()
        {
            #region Filling rainOnTrack array

            int startvalue = 0;

            int x = rGen.Next(0, 5);
            if (x != 4)
            {
                startvalue = 0;
            }
            else
            {
                startvalue = rGen.Next(0, 100);
            }

            rainOnTrack = new int[currentCircuit.laps];

            rainOnTrack[0] = startvalue;

            bool rainingLess = true;
            bool rainingHarder = false;

            x = rGen.Next(0, 5);
            if (x != 4)
            {
                rainingLess = true;
                rainingHarder = false;
            }
            else
            {
                rainingLess = false;
                rainingHarder = true;
            }

            for (int i = 1; i < rainOnTrack.Length; i++)
            {

                if (rainingHarder)
                {
                    rainOnTrack[i] = rainOnTrack[i - 1] + rGen.Next(1, 11);

                    x = rGen.Next(0, 15);
                    if (x != 0)
                    {
                        rainingLess = false;
                        rainingHarder = true;
                    }
                    else
                    {
                        rainingLess = true;
                        rainingHarder = false;
                    }
                }
                else if (rainingLess)
                {
                    rainOnTrack[i] = rainOnTrack[i - 1] + rGen.Next(-40, -10);

                    x = rGen.Next(0, 15);
                    if (x != 0)
                    {
                        rainingLess = true;
                        rainingHarder = false;
                    }
                    else
                    {
                        rainingLess = false;
                        rainingHarder = true;
                    }
                }

                if (rainOnTrack[i] < 0)
                {
                    rainOnTrack[i] = 0;
                }
                else if (rainOnTrack[i] > 100)
                {
                    rainOnTrack[i] = 100;
                }
            }
            #endregion
            #region Filling waterOnTrack array
            waterOnTrack = new int[currentCircuit.laps];

            for (int currentLap = 0; currentLap < rainOnTrack.Length; currentLap++)
            {
                double value = 0;

                for (int i = currentLap - 4; i <= currentLap; i++)
                {
                    if (i < 0) value += 0;
                    else value += rainOnTrack[i];
                }

                waterOnTrack[currentLap] = Convert.ToInt32(Math.Floor(value / 5));
            }

            #endregion
        }
        //----------Tyres--------------------------------------------------------------
        static void SelectTyrePlayer()
        {
            // Refresh menu with correct value
            if (choosenTyreIndex == tyres.Length - 1)
            {
                choosenTyreIndex = 0;
                PreRaceMenuOptions[0] = new Options(string.Format("Select tyre: {0}", tyres[choosenTyreIndex]), () => SelectTyrePlayer());
            }
            else
            {
                choosenTyreIndex++;
                PreRaceMenuOptions[0] = new Options(string.Format("Select tyre: {0}", tyres[choosenTyreIndex]), () => SelectTyrePlayer());
            }

            // Write the menu out
            WriteMenu(PreRaceMenuOptions, PreRaceMenuOptions[0]);
        }
        static void SelectTyreBots()
        {
            WriteWeather();

            foreach (var item in Drivers)
            {
                if (item.name == playerDriver.name)
                {
                    /*string input = "";
                    do
                    {
                        Console.ForegroundColor = ConsoleColor.Blue;
                        /*if (waterOnTrack[0] <= 20)
                        {
                            Console.WriteLine(" Az eső csepereg!");
                        }
                        else if (waterOnTrack[0] > 20 && waterOnTrack[0] <= 40)
                        {
                            Console.WriteLine(" Az eső kis mértékben esik!");
                        }
                        else if (waterOnTrack[0] > 40 && waterOnTrack[0] <= 60)
                        {
                            Console.WriteLine(" Az eső esik!");
                        }
                        else if (waterOnTrack[0] > 60 && waterOnTrack[0] <= 80)
                        {
                            Console.WriteLine(" Az eső nagy mértékben esik!");
                        }
                        else if (waterOnTrack[0] > 80)
                        {
                            Console.WriteLine(" !!! NAGYON esik !!!");
                        }

                        Console.ForegroundColor = ConsoleColor.Gray;

                        Console.WriteLine(" Válasszon gumit a versenyzőjének ([s/m/h] - [i/w]): ");
                        input = Console.ReadLine();
                    } while (input != "s" && input != "m" && input != "h" && input != "i" && input != "w");
                    while (input != "u" && input != "z" && input != "s" && input != "m" && input != "h" && input != "v");

                    item.tyreType = input;
                    item.allTyres += input;*/
                }
                else
                {
                    if (rainOnTrack[0] < 18)
                    {
                        int x = rGen.Next(1, 4);

                        /*if (x == 1)
                        {
                            item.tyreType = "u";
                            item.allTyres += "u";
                        }
                        else if (x == 2)
                        {
                            item.tyreType = "z";
                            item.allTyres += "z";
                        }*/

                        if (x == 1)
                        {
                            item.tyreType = "s";
                            item.allTyres += "s";
                        }
                        else if (x == 2)
                        {
                            item.tyreType = "m";
                            item.allTyres += "m";
                        }
                        else if (x == 3)
                        {
                            item.tyreType = "h";
                            item.allTyres += "h";
                        }

                        /*else if (x == 6)
                        {
                            item.tyreType = "v";
                            item.allTyres += "v";
                        }*/
                    }

                    else if (rainOnTrack[0] >= 18 && rainOnTrack[0] < 23)
                    {
                        int x = rGen.Next(1, 5);

                        if (x == 1)
                        {
                            item.tyreType = "s";
                            item.allTyres += "s";
                        }
                        else if (x == 2)
                        {
                            item.tyreType = "m";
                            item.allTyres += "m";
                        }
                        else if (x == 3)
                        {
                            item.tyreType = "h";
                            item.allTyres += "h";
                        }
                        else if (x == 4)
                        {
                            item.tyreType = "i";
                            item.allTyres += "i";
                        }

                    }
                    else if (rainOnTrack[0] >= 23 && rainOnTrack[0] < 57)
                    {
                        item.tyreType = "i";
                        item.allTyres += "i";
                    }
                    else if (rainOnTrack[0] >= 57 && rainOnTrack[0] < 65)
                    {
                        int x = rGen.Next(1, 3);

                        if (x == 1)
                        {
                            item.tyreType = "i";
                            item.allTyres += "i";
                        }
                        else if (x == 2)
                        {
                            item.tyreType = "w";
                            item.allTyres += "w";
                        }
                    }
                    else
                    {
                        item.tyreType = "w";
                        item.allTyres += "w";
                    }
                }
            }
        }
        static void SelectTyrePlayerMidRace()
        {
            // Refresh menu with correct value
            if (choosenTyreIndex == tyres.Length - 1)
            {
                choosenTyreIndex = 0;
                RaceManagementMenuOptions[1] = new Options(string.Format("Select tyre: {0}", tyres[choosenTyreIndex]), () => SelectTyrePlayerMidRace());
            }
            else
            {
                choosenTyreIndex++;
                RaceManagementMenuOptions[1] = new Options(string.Format("Select tyre: {0}", tyres[choosenTyreIndex]), () => SelectTyrePlayerMidRace());
            }

            // Write the menu out
            WriteRaceMenu(RaceManagementMenuOptions, RaceManagementMenuOptions[0]);
        }
        //----------Qualy Stuff--------------------------------------------------------------
        static void SelectQualy()
        {
            // Refresh menu with correct value
            if (reversedQualy)
            {
                reversedQualy = false;
                PreRaceMenuOptions[1] = new Options(string.Format("Qualy Type: {0}", "Normal"), () => SelectQualy());
            }
            else
            {
                reversedQualy = true;
                PreRaceMenuOptions[1] = new Options(string.Format("Qualy Type: {0}", "Reversed"), () => SelectQualy());
            }

            // Write the menu out
            WriteMenu(PreRaceMenuOptions, PreRaceMenuOptions[1]);
        }
        static void QualyNormal()
        {
            int gridPos = 1;

            foreach (var item in Drivers)
            {
                SetLastLap(item);

                if (item.tyreType == "u")
                {
                }
                else if (item.tyreType == "z")
                {
                    item.lastLap += 0.5;
                }
                else if (item.tyreType == "s")
                {
                    item.lastLap += 1;
                }
                else if (item.tyreType == "m")
                {
                    item.lastLap += 1.5;
                }
                else if (item.tyreType == "h")
                {
                    item.lastLap += 2;
                }
                else if (item.tyreType == "v")
                {
                    item.lastLap += 2.5;
                }
            }
            Drivers = Drivers.OrderBy(o => o.lastLap).ToList();
            foreach (var item in Drivers)
            {
                item.gridPos = gridPos;
                gridPos++;

                TimeSpan szeparátor;
                szeparátor = TimeSpan.FromSeconds(item.lastLap);
                string korido = szeparátor.ToString(@"mm\:ss\:fff");
                WriteMessageCenter(String.Format(" {0,2} {1,20} {2,10} {3}", item.gridPos, item.name, korido, item.tyreType), gridPos + 1);

                item.lastLap = 0;
            }
        }
        static void QualyReversed()
        {
            int gridPos = 1;

            foreach (var item in Drivers)
            {
                SetLastLap(item);

                if (item.tyreType == "u")
                {
                }
                else if (item.tyreType == "z")
                {
                    item.lastLap += 0.5;
                }
                else if (item.tyreType == "s")
                {
                    item.lastLap += 1;
                }
                else if (item.tyreType == "m")
                {
                    item.lastLap += 1.5;
                }
                else if (item.tyreType == "h")
                {
                    item.lastLap += 2;
                }
                else if (item.tyreType == "v")
                {
                    item.lastLap += 2.5;
                }
            }
            for (int i = 1; i < Drivers.Count; i++)
            {
                Championship.Where(o => o.name == Drivers.ElementAt(i - 1).name).First().points += i == 1 ? 10 : i == 2 ? 9 : i == 3 ? 8 : i == 4 ? 7 : i == 5 ? 6 : i == 6 ? 5 : i == 7 ? 4
                    : i == 8 ? 3 : i == 9 ? 2 : i == 10 ? 1 : 0;
            }
            Drivers = Drivers.OrderByDescending(o => o.lastLap).ToList();
            foreach (var item in Drivers)
            {
                item.gridPos = gridPos;
                gridPos++;

                TimeSpan szeparátor;
                szeparátor = TimeSpan.FromSeconds(item.lastLap);
                string korido = szeparátor.ToString(@"mm\:ss\:fff");
                WriteMessageCenter(String.Format(" {0,2} {1,20} {2,10} {3}", item.gridPos, item.name, korido, item.tyreType), gridPos + 1);

                item.lastLap = 0;
            }
        }
        //----------Simulating race lap by lap--------------------------------------------------------------
        static void OneLapSimulate()
        {
            Console.Clear();

            double howWet = waterOnTrack[Drivers[Drivers.Count - 1].compLaps];

            foreach (var item in Drivers)
            {
                double emberseg = rGen.Next(-150, 150);
                double gumiFogyasztas = -1;
                double gumiFogyasztasX = 72 / Convert.ToDouble(currentCircuit.laps);
                double gumiPace = -1;

                if (item.tyreType == "u")
                {
                    gumiFogyasztas = 6.8 * gumiFogyasztasX;
                    gumiPace = 0 + (howWet * 0.4);
                }
                else if (item.tyreType == "z")
                {
                    gumiFogyasztas = 5.6 * gumiFogyasztasX;
                    gumiPace = 0.5 + (howWet * 0.39);
                }
                else if (item.tyreType == "s")
                {
                    gumiFogyasztas = 4.4 * gumiFogyasztasX;
                    gumiPace = 1 + (howWet * 0.38);
                }

                else if (item.tyreType == "m")
                {
                    gumiFogyasztas = 3.2 * gumiFogyasztasX;
                    gumiPace = 1.5 + (howWet * 0.37);
                }

                else if (item.tyreType == "h")
                {
                    gumiFogyasztas = 2 * gumiFogyasztasX;
                    gumiPace = 2 + (howWet * 0.36);
                }
                else if (item.tyreType == "v")
                {
                    gumiFogyasztas = 0.8 * gumiFogyasztasX;
                    gumiPace = 2.5 + (howWet * 0.35);
                }
                else if (item.tyreType == "i")
                {
                    gumiFogyasztas = 2.5 * gumiFogyasztasX;
                    gumiPace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                }

                else if (item.tyreType == "w")
                {
                    gumiFogyasztas = 2.2 * gumiFogyasztasX;
                    gumiPace = 9 + (Math.Abs(75 - howWet) * 0.1);
                }

                SetLastLap(item);
                item.lastLap += gumiPace;

                if (item.compLaps == 0)
                {
                    item.lastLap += 0.5 * item.gridPos;
                }
                item.compLaps++;
                item.tyreState -= gumiFogyasztas;
            }
            Overtake();
            foreach (var item in Drivers)
            {
                item.raceTime += item.lastLap;
            }
            Drivers = Drivers.OrderBy(o => o.raceTime).ToList();
            int hanyadik = 1;
            Console.ForegroundColor = ConsoleColor.Gray;

            WriteTrackInfo();

            WriteWeather();

            WriteMessageCenter("----------------------------------------------------------------------------------------------------------------------------------------------", 14);
            WriteMessageCenter(String.Format(" {0,8} {1,20}   {2,9}   {3,12}   {4,9}   {5,5}   {6,12}   {7,14}   {8,14}   {9,10}",
                "Position", "Pilot", "Last", "Race Time", "Tyre", "Stops", "Tyre History", "Gap To Leader", "Gap Ahead", "Tyre State"), 15);
            Console.WriteLine();
            for (int i = 0; i < Drivers.Count; i++)
            {
                double jatekosIdo = 0;
                foreach (var item in Drivers)
                {
                    if (item.name == playerDriver.name)
                    {
                        jatekosIdo = item.raceTime;
                    }
                }

                if (Drivers[i].name == playerDriver.name)
                {
                    jatekosIdo = Drivers[i].raceTime;
                    Console.ForegroundColor = allColors[choosenPlayerColorIndex];
                }
                else if (i % 2 == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Gray;

                    if (jatekosIdo + 22.3 < Drivers[i].raceTime && playerDriver.name != "")
                        Console.ForegroundColor = normalColors[choosenPitWindowColorIndex];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.DarkGray;

                    if (jatekosIdo + 22.3 < Drivers[i].raceTime && playerDriver.name != "")
                        Console.ForegroundColor = darkColors[choosenPitWindowColorIndex];
                }

                Drivers[i].gridPos = hanyadik;
                TimeSpan szeparátor;
                szeparátor = TimeSpan.FromSeconds(Drivers[i].lastLap);
                string korido = szeparátor.ToString(@"mm\:ss\:fff");
                szeparátor = TimeSpan.FromSeconds(Drivers[i].raceTime);
                string versenyido = szeparátor.ToString(@"hh\:mm\:ss\:fff");
                string különbségToLeader = "+ ";
                string különbségToAhead = "+ ";
                if (i != 0)
                {
                    szeparátor = TimeSpan.FromSeconds(Drivers[i].raceTime - Drivers[0].raceTime);
                    különbségToLeader += szeparátor.ToString(@"hh\:mm\:ss\:fff");
                    szeparátor = TimeSpan.FromSeconds(Drivers[i].raceTime - Drivers[i - 1].raceTime);
                    különbségToAhead += szeparátor.ToString(@"hh\:mm\:ss\:fff");
                }
                else
                {
                    különbségToLeader = "";
                    különbségToAhead = "";
                }
                WriteMessageCenter(String.Format(" {0,8} {1,20}   {2,9}   {3,12}   {4,9}   {5,5}   {6,12}   {7,14}   {8,14}   {9,10}",
                    Drivers[i].gridPos, Drivers[i].name, korido, versenyido, Drivers[i].tyreType, Drivers[i].stops, Drivers[i].allTyres, különbségToLeader, különbségToAhead, String.Format("{0:0.###}", Drivers[i].tyreState) + "%"), 15 + Drivers[i].gridPos);
                hanyadik++;
                Drivers[i].lastLap = 0;
                BotPitstop(Drivers[i]);
                if ((hanyadik == Drivers.Count + 1) && (Drivers[i].compLaps == currentCircuit.laps))
                {
                    //Results();
                    Console.WriteLine();

                    string flag = "CHEQUEREDFLAG";
                    string message = " ...Press any key to go back to the main menu... ";
                    Console.SetCursorPosition(Console.WindowWidth / 2 - flag.Length / 2, 2);
                    for (int j = 0; j < flag.Length; j++)
                    {
                        if (j % 2 == 0)
                        {
                            Console.ForegroundColor = ConsoleColor.White;
                            Console.BackgroundColor = ConsoleColor.DarkGray;
                        }
                        else
                        {
                            Console.ForegroundColor = ConsoleColor.DarkGray;
                            Console.BackgroundColor = ConsoleColor.White;
                        }
                        Console.Write("{0}", flag[j]);
                    }
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;

                    WriteMessageCenter(message, 4);

                    Results();
                    exit = true;
                    Console.ReadKey();
                }
            }
        }
        static void SetLastLap(Driver driver)
        {
            int downForce = driver.frontWing + driver.rearWing + driver.frontRideHeight + driver.rearRideHeight;
            int carBalance = (driver.rearWing - driver.frontWing) + (driver.rearRideHeight - driver.frontRideHeight) + (driver.frontSuspension + driver.rearSuspension);
            int traction = (((driver.frontWing + driver.rearWing) - (driver.frontTyrePressure + driver.rearTyrePressure)) + driver.rearSuspension);
            int breakBalance = ((driver.brakePressure - driver.frontBrakeBias) - driver.frontSuspension);
            int topSpeed = (60 - ((driver.frontWing + driver.rearWing) + (driver.frontTyrePressure + driver.rearTyrePressure) + (driver.frontRideHeight + driver.rearRideHeight)));

            int ember = rGen.Next(-200, 500);

            driver.lastLap += currentCircuit.optLapTime + ((100 - Convert.ToDouble(driver.skill)) / 50) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                   (ember / 1000) + ((100 - Convert.ToDouble(driver.tyreState)) / 25) + (Math.Abs(currentCircuit.optDownForce - downForce) / 10) +
                   (Math.Abs(currentCircuit.optCarBalance - carBalance) / 10) + (Math.Abs(currentCircuit.optTraction - traction) / 10)
                   + (Math.Abs(currentCircuit.optBreakBalance - breakBalance) / 10) + (Math.Abs(currentCircuit.optTopSpeed - topSpeed) / 10);
        }
        //----------Pit stops--------------------------------------------------------------
        static void PitStop()
        {
            foreach (var item in Drivers)
            {
                if (item.name == playerDriver.name)
                {
                    item.lastLap += 22.3;
                    item.tyreType = tyres[choosenTyreIndex];
                    item.tyreState = 100;
                    item.stops++;
                    item.allTyres += tyres[choosenTyreIndex];
                }
            }

            OneLapSimulate();
        }
        static void BotPitstop(Driver driver)
        {
            if (driver.name != playerDriver.name)
            {
                int a = -1;
                int opt = 95;
                a = rGen.Next(26, 51);
                double tyreWear = 0;
                double gumiFogyasztasX = 72 / Convert.ToDouble(currentCircuit.laps);
                double howWet = waterOnTrack[Drivers[Drivers.Count - 1].compLaps - 1];
                double tyrePace = 0;
                double estimation1 = 0;
                double estimation2 = 0;

                /*if (pilota.tyreType == "u")
                {
                    tyrePace = 0 + (howWet * 0.4);
                    tyreWear = 6.8 * gumiFogyasztasX;
                }
                else if (pilota.tyreType == "z")
                {
                    tyrePace = 0.5 + (howWet * 0.39);
                    tyreWear = 5.6 * gumiFogyasztasX;
                }*/

                if (driver.tyreType == "s")
                {
                    tyrePace = 1 + (howWet * 0.38);
                    tyreWear = 4.4 * gumiFogyasztasX;
                }
                else if (driver.tyreType == "m")
                {
                    tyrePace = 1.5 + (howWet * 0.37);
                    tyreWear = 3.2 * gumiFogyasztasX;
                }
                else if (driver.tyreType == "h")
                {
                    tyrePace = 2 + (howWet * 0.36);
                    tyreWear = 2 * gumiFogyasztasX;
                }

                /*else if (pilota.tyreType == "v")
                {
                    tyrePace = 2.5 + (howWet * 0.35);
                    tyreWear = 0.8 * gumiFogyasztasX;
                }*/

                else if (driver.tyreType == "i")
                {
                    tyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                    tyreWear = 2.5 * gumiFogyasztasX;
                }
                else if (driver.tyreType == "w")
                {
                    tyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                    tyreWear = 2.2 * gumiFogyasztasX;
                }

                #region Old version for 6 dry compounds (no int and wet)
                /*if (pilota.tyreState <= a)
                {
                    a = r.Next(1, 7);
                    if (a == 1)
                    {
                        double newtyrePace = 0;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "u";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "u";
                        }
                    }
                    else if (a == 2)
                    {
                        double newtyrePace = 0.5;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "z";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "z";
                        }
                    }
                    else if (a == 3)
                    {
                        double newtyrePace = 1.25;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "s";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "s";
                        }
                    }
                    else if (a == 4)
                    {
                        double newtyrePace = 1.75;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }
                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "m";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "m";
                        }

                    }
                    else if (a == 5)
                    {
                        double newtyrePace = 2.5;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }
                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "h";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "h";
                        }
                    }
                    else if (a == 6)
                    {
                        double newtyrePace = 3;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "v";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "v";
                        }
                    }
                }
                else if (pilota.tyreState <= 10)
                {
                    a = r.Next(1, 7);
                    if (a == 1)
                    {
                        double newtyrePace = 0;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "u";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "u";
                        }
                    }
                    else if (a == 2)
                    {
                        double newtyrePace = 0.5;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "z";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "z";
                        }
                    }
                    else if (a == 3)
                    {
                        double newtyrePace = 1.25;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "s";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "s";
                        }
                    }
                    else if (a == 4)
                    {
                        double newtyrePace = 1.75;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }
                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "m";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "m";
                        }

                    }
                    else if (a == 5)
                    {
                        double newtyrePace = 2.5;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }
                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "h";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "h";
                        }
                    }
                    else if (a == 6)
                    {
                        double newtyrePace = 3;
                        for (int i = 0; i < (korokszama - pilota.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(pilota.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(pilota.skill)) / 50)) - (((100 - Convert.ToDouble(pilota.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            pilota.tyreType = "v";
                            pilota.tyreState = 100;
                            pilota.lastLap += 22.3;
                            pilota.stops++;
                            pilota.allTyres += "v";
                        }
                    }
                }*/
                #endregion

                if (howWet < 18)
                {
                    if (driver.tyreType != "s" && driver.tyreType != "m" && driver.tyreType != "h")
                    {
                        a = rGen.Next(1, 4);

                        if (a == 1)
                        {
                            double newtyrePace = 1 + (howWet * 0.38);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "s";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "s";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 1.5 + (howWet * 0.37);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "m";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "m";
                            }
                        }
                        else if (a == 3)
                        {
                            double newtyrePace = 2 + (howWet * 0.36);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "h";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "h";
                            }
                        }
                    }
                    else if (driver.tyreState <= a)
                    {
                        a = rGen.Next(1, 4);

                        if (a == 1)
                        {
                            double newtyrePace = 1 + (howWet * 0.38);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "s";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "s";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 1.5 + (howWet * 0.37);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "m";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "m";
                            }
                        }
                        else if (a == 3)
                        {
                            double newtyrePace = 2 + (howWet * 0.36);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "h";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "h";
                            }
                        }
                    }
                    else if (driver.tyreState <= 10)
                    {
                        a = rGen.Next(1, 4);
                        if (a == 1)
                        {
                            double newtyrePace = 1 + (howWet * 0.38);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "s";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "s";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 1.5 + (howWet * 0.37);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "m";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "m";
                            }
                        }
                        else if (a == 3)
                        {
                            double newtyrePace = 2 + (howWet * 0.36);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "h";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "h";
                            }
                        }
                    }
                }
                else if (howWet >= 18 && howWet < 23)
                {
                    if (driver.tyreState <= a)
                    {
                        a = rGen.Next(1, 6);
                        if (a == 1)
                        {
                            double newtyrePace = 1 + (howWet * 0.38);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "s";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "s";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 1.5 + (howWet * 0.37);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "m";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "m";
                            }
                        }
                        else if (a == 3)
                        {
                            double newtyrePace = 2 + (howWet * 0.36);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "h";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "h";
                            }
                        }
                        else if (a == 4)
                        {
                            double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "i";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "i";
                            }
                        }
                        else if (a == 5)
                        {
                            double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "w";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "w";
                            }
                        }
                    }
                    else if (driver.tyreState <= 10)
                    {
                        a = rGen.Next(1, 6);
                        if (a == 1)
                        {
                            double newtyrePace = 1 + (howWet * 0.38);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "s";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "s";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 1.5 + (howWet * 0.37);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "m";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "m";
                            }
                        }
                        else if (a == 3)
                        {
                            double newtyrePace = 2 + (howWet * 0.36);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "h";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "h";
                            }
                        }
                        else if (a == 4)
                        {
                            double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "i";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "i";
                            }
                        }
                        else if (a == 5)
                        {
                            double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "w";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "w";
                            }
                        }
                    }
                }
                else if (howWet >= 23 && howWet < 57)
                {
                    if (driver.tyreType != "i")
                    {
                        a = rGen.Next(1, 3);
                        if (a == 1)
                        {
                            double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "i";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "i";
                            }
                        }
                    }
                    else if (driver.tyreState <= a)
                    {
                        double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                        for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            driver.tyreType = "i";
                            driver.tyreState = 100;
                            driver.lastLap += 22.3;
                            driver.stops++;
                            driver.allTyres += "i";
                        }
                    }
                }
                else if (howWet >= 57 && howWet < 65)
                {
                    if (driver.tyreType != "i" && driver.tyreType != "w")
                    {
                        a = rGen.Next(1, 3);

                        if (a == 1)
                        {
                            a = rGen.Next(1, 3);
                            if (a == 1)
                            {
                                double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                                for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                                {
                                    estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                        ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                    estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                        ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                                }

                                if (estimation1 < (estimation2 + 22.3))
                                {

                                }
                                else
                                {
                                    driver.tyreType = "i";
                                    driver.tyreState = 100;
                                    driver.lastLap += 22.3;
                                    driver.stops++;
                                    driver.allTyres += "i";
                                }
                            }
                        }
                        else if (a == 2)
                        {
                            a = rGen.Next(1, 3);
                            if (a == 1)
                            {
                                double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                                for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                                {
                                    estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                        ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                    estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                        ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                                }

                                if (estimation1 < (estimation2 + 22.3))
                                {

                                }
                                else
                                {
                                    driver.tyreType = "w";
                                    driver.tyreState = 100;
                                    driver.lastLap += 22.3;
                                    driver.stops++;
                                    driver.allTyres += "w";
                                }
                            }
                        }
                    }
                    else if (driver.tyreState <= a)
                    {
                        a = rGen.Next(1, 3);

                        if (a == 1)
                        {
                            double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "i";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "i";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "w";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "w";
                            }
                        }
                    }
                    else if (driver.tyreState <= 10)
                    {
                        a = rGen.Next(1, 3);

                        if (a == 1)
                        {
                            double newtyrePace = 7.5 + (Math.Abs(30 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "i";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "i";
                            }
                        }
                        else if (a == 2)
                        {
                            double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }
                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "w";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "w";
                            }
                        }
                    }
                }
                else
                {
                    if (driver.tyreType != "w")
                    {
                        a = rGen.Next(1, 3);
                        if (a == 1)
                        {
                            double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                            for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                            {
                                estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                                estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                    ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                            }

                            if (estimation1 < (estimation2 + 22.3))
                            {

                            }
                            else
                            {
                                driver.tyreType = "w";
                                driver.tyreState = 100;
                                driver.lastLap += 22.3;
                                driver.stops++;
                                driver.allTyres += "w";
                            }
                        }
                    }
                    else if (driver.tyreState <= a)
                    {
                        double newtyrePace = 9 + (Math.Abs(75 - howWet) * 0.1);
                        for (int i = 0; i < (currentCircuit.laps - driver.compLaps); i++)
                        {
                            estimation1 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(driver.tyreState - (i * tyreWear))) / 25) + tyrePace;
                            estimation2 += opt + (((100 - Convert.ToDouble(driver.skill)) / 50)) - (((100 - Convert.ToDouble(driver.carPerf)) * -1) / 100) +
                                ((100 - Convert.ToDouble(100 - (i * tyreWear))) / 25) + newtyrePace;
                        }

                        if (estimation1 < (estimation2 + 22.3))
                        {

                        }
                        else
                        {
                            driver.tyreType = "w";
                            driver.tyreState = 100;
                            driver.lastLap += 22.3;
                            driver.stops++;
                            driver.allTyres += "w";
                        }
                    }
                }
            }
        }
        //----------Automatic mid-race actions--------------------------------------------------------------
        static void Overtake()
        {
            for (int i = 0; i < Drivers.Count; i++)
            {
                #region előzési feltételek
                int overtake = 0;
                double random = 0;
                if (Drivers[i].gridPos != 1)
                {
                    if (Drivers[i - 1].lastLap < currentCircuit.optLapTime + 20)
                    {
                        if ((Drivers[i].raceTime - Drivers[i - 1].raceTime) < 1)
                        {
                            if (Drivers[i].lastLap < Drivers[i - 1].lastLap)
                            {
                                #region megvalósul-e
                                if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.3 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake == 1)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.4 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 2)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.5 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 3)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.6 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 4)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.7 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 5)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.8 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 6)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-0.9 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 7)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-1 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 8)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) > (-1.1 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 9)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                else if ((Drivers[i].lastLap - Drivers[i - 1].lastLap) < (-1.1 * currentCircuit.ovtkMultiplier))
                                {
                                    overtake = rGen.Next(1, 11);
                                    if (overtake <= 10)
                                    {
                                        Drivers[i].lastLap -= (Drivers[i].raceTime - Drivers[i - 1].raceTime);
                                        Drivers[i].gridPos--;
                                        Drivers[i - 1].gridPos++;
                                    }
                                    else
                                    {
                                        random = rGen.Next(-150, 150);
                                        Drivers[i].lastLap = Drivers[i - 1].lastLap + (random / 1000);
                                    }
                                }
                                #endregion
                            }
                            else if (Drivers[i].lastLap > Drivers[i - 1].lastLap)
                            {

                            }
                        }
                    }
                }
                #endregion
            }
        }
        //----------Post race Actions--------------------------------------------------------------
        static void Results()
        {

            for (int i = 1; i < Drivers.Count; i++)
            {
                Championship.Where(o => o.name == Drivers.ElementAt(i - 1).name).First().points += i == 1 ? 25 : i == 2 ? 18 : i == 3 ? 15 : i == 4 ? 12 : i == 5 ? 10 : i == 6 ? 8 : i == 7 ? 6
                    : i == 8 ? 4 : i == 9 ? 2 : i == 10 ? 1 : 0;
            }
            Championship = Championship.OrderByDescending(o => o.points).ToList();
            StreamWriter sw = new StreamWriter("Bajnoksag.txt");
            foreach (var item in Championship)
            {
                sw.WriteLine(item.name + ";" + item.teamName + ";" + item.points);
            }
            sw.Close();

            //Reset every value
            foreach (var driver in Drivers)
            {
                driver.lastLap = 0;
                driver.raceTime = 0;
                driver.stops = 0;
                driver.tyreState = 100;
                driver.compLaps = 0;
                driver.tyreType = "s";
                driver.allTyres = "";
                driver.fuel = 100;
            }
        }
        //----------Standings Window Actions-----------------------------------------------------------------------
        static void ShowChampionshipTable()
        {
            Championship.OrderByDescending(x => x.points);
            for (int i = 0; i < Championship.Count; i++)
            {
                if (i % 2 == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Gray;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.DarkGray;

                }

                WriteMessageCenter(String.Format("{0,20} - {1,3}", Championship[i].name, Championship[i].points), i + 3);
            }

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Gray;
        }
        static void ResetChampionship()
        {
            StreamWriter sw = new StreamWriter("Bajnoksag.txt");

            foreach (var driver in Championship)
            {
                driver.points = 0;
                sw.WriteLine(driver.name + ";" + driver.teamName + ";" + driver.points);
            }

            sw.Close();
        }
        //---------PreferencesWindow Actions--------------------------------------------------------
        static void SelectHighlightColor()
        {
            // Refresh menu with correct value
            if (choosenHighlightColorIndex == allColors.Length - 1)
            {
                choosenHighlightColorIndex = 0;
                PreferencesMenuOptions[0] = new Options(string.Format("Main highlight color: {0}", allColors[choosenHighlightColorIndex].ToString()), () => SelectHighlightColor());
            }
            else
            {
                choosenHighlightColorIndex++;
                PreferencesMenuOptions[0] = new Options(string.Format("Main highlight color: {0}", allColors[choosenHighlightColorIndex].ToString()), () => SelectHighlightColor());
            }

            // Write the menu out
            WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[0]);
        }
        static void SelectPlayerColor()
        {
            if (choosenPlayerColorIndex == allColors.Length - 1)
            {
                choosenPlayerColorIndex = 0;
                PreferencesMenuOptions[1] = new Options(string.Format("Player color: {0}", allColors[choosenPlayerColorIndex].ToString()), () => SelectPlayerColor());
            }
            else
            {
                choosenPlayerColorIndex++;
                PreferencesMenuOptions[1] = new Options(string.Format("Player color: {0}", allColors[choosenPlayerColorIndex].ToString()), () => SelectPlayerColor());
            }

            // Write the menu out
            WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[1]);
        }
        static void SelectPitWindowColor()
        {
            if (choosenPitWindowColorIndex == normalColors.Length - 1)
            {
                choosenPitWindowColorIndex = 0;
                PreferencesMenuOptions[2] = new Options(string.Format("Player color: {0}", normalColors[choosenPitWindowColorIndex].ToString()), () => SelectPitWindowColor());
            }
            else
            {
                choosenPitWindowColorIndex++;
                PreferencesMenuOptions[2] = new Options(string.Format("Player color: {0}", normalColors[choosenPitWindowColorIndex].ToString()), () => SelectPitWindowColor());
            }

            // Write the menu out
            WriteMenu(PreferencesMenuOptions, PreferencesMenuOptions[2]);
        }
        //----------Display stuff--------------------------------------------------------------
        static void WriteMenu(List<Options> options, Options selectedOption)
        {
            Console.Clear();

            // This helps with the rows
            int index = 0;

            foreach (Options option in options)
            {
                if (option == selectedOption)
                {
                    Console.ForegroundColor = ConsoleColor.White;
                    Console.BackgroundColor = allColors[choosenHighlightColorIndex];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;
                }

                WriteMessageCenter(" " + option.Name + " ", (Console.WindowHeight / 2) + ((index * 2) - (options.Count)));
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.BackgroundColor = ConsoleColor.Black;

                index++;
            }
        }
        static void WriteChampionshipMenu(List<Options> options, Options selectedOption)
        {
            Console.Clear();

            // This helps with the rows
            int index = 0;

            foreach (Options option in options)
            {
                if (option == selectedOption)
                {
                    Console.ForegroundColor = ConsoleColor.White;
                    Console.BackgroundColor = allColors[choosenHighlightColorIndex];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;
                }

                WriteMessageCenter(" " + option.Name + " ", (Console.WindowHeight - 10) + ((index * 2) - (options.Count)));
                Console.ForegroundColor = ConsoleColor.Gray;
                Console.BackgroundColor = ConsoleColor.Black;

                index++;
            }
        }
        static void WriteRaceMenu(List<Options> options, Options selectedOption)
        {
            //Console.Clear();

            // This helps with the rows
            int index = 0;

            foreach (Options option in options)
            {
                if (option == selectedOption)
                {
                    Console.ForegroundColor = ConsoleColor.White;
                    Console.BackgroundColor = allColors[choosenHighlightColorIndex];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;
                }

                if (index == 0)
                {
                    WriteMessageCenter(" " + option.Name + " ", 5 + ((index * 2) - (options.Count)));
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;
                }
                else
                {
                    WriteMessageCenter(" " + option.Name + " ", 40 + ((index * 2) - (options.Count)));
                    Console.ForegroundColor = ConsoleColor.Gray;
                    Console.BackgroundColor = ConsoleColor.Black;
                }
                index++;
            }
        }
        static void WriteWeather()
        {
            Console.SetCursorPosition(Console.WindowWidth - 20, 1);
            Console.WriteLine("Weather forecast");

            int index = 3;
            int randomizer = 0;
            int chance = 0;

            for (int i = Drivers[Drivers.Count - 1].compLaps; i < (Drivers[Drivers.Count - 1].compLaps) + 10; i++)
            {
                if (i >= rainOnTrack.Length)
                {

                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Blue;
                    Console.SetCursorPosition(Console.WindowWidth - 18, index);
                    if (rainOnTrack[i] < 5)
                    {
                        chance = rainOnTrack[i];
                    }
                    else if (rainOnTrack[i] > 94)
                    {
                        chance = rainOnTrack[i];
                    }
                    else
                    {
                        randomizer -= (rGen.Next(-5, 6));
                        chance = rainOnTrack[i] - randomizer;
                    }

                    if (chance < 0)
                    {
                        chance = 0;
                    }
                    else if (chance > 100)
                    {
                        chance = 100;
                    }
                    Console.WriteLine("Lap {0} - {1}%", i + 1, chance);
                    Console.ForegroundColor = ConsoleColor.Gray;

                    // Move one line lower
                    index++;
                }
            }
        }
        static void WriteTrackInfo()
        {
            double howWet = 0;

            if (Drivers[Drivers.Count - 1].compLaps != currentCircuit.laps)
            {
                howWet = waterOnTrack[Drivers[Drivers.Count - 1].compLaps];

            }
            else
            {
                howWet = waterOnTrack[Drivers[Drivers.Count - 1].compLaps-1];
            }

            Console.SetCursorPosition(0, 0);
            Console.WriteLine();
            Console.WriteLine(" {0} - {1}/{2}", currentCircuit.location, Drivers[Drivers.Count - 1].compLaps, currentCircuit.laps);
            Console.WriteLine();
            Console.WriteLine(" Water on track:");

            if (howWet == 0)
            {

            }
            else
            {
                double x = (howWet / 20) + 1;
                x = Math.Floor(x);
                for (int i = 0; i < x; i++)
                {
                    Console.WriteLine();
                    for (int j = 0; j < 7; j++)
                    {
                        Console.ForegroundColor = ConsoleColor.Blue;
                        Console.Write(" .°");
                        Console.ForegroundColor = ConsoleColor.Gray;
                    }
                }
            }
        }
        static void WriteMessageCenter(string message, int verticalPos)
        {
            Console.SetCursorPosition(Console.WindowWidth / 2 - message.Length / 2, verticalPos);
            Console.WriteLine(message);
        }
    }
}

