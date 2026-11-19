using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Pause_Resume
{
    class Driver
    {
        public string name;
        public int skill;
        public string team;
        public int carPerf;

        public int gridPos;

        public int fuel;

        public double tyreState;
        public string tyreType;

        public double lastLap;
        public double raceTime;
        public int compLaps;

        public int stops;
        public string allTyres;

        public int frontWing;
        public int rearWing;
        public int frontSuspension;
        public int rearSuspension;
        public int frontRideHeight;
        public int rearRideHeight;
        public int frontBrakeBias;
        public int brakePressure;
        public int frontTyrePressure;
        public int rearTyrePressure;

        public Driver(string sor)
        {
            string[] adatok = sor.Split(';');

            name = adatok[0];
            skill = Convert.ToInt32(adatok[1]);
            team = adatok[2];
            carPerf = Convert.ToInt32(adatok[3]);

            gridPos = Convert.ToInt32(adatok[4]);

            fuel = Convert.ToInt32(adatok[5]);

            tyreState = Convert.ToDouble(adatok[6]);
            tyreType = adatok[7];

            lastLap = Convert.ToDouble(adatok[8]);
            raceTime = Convert.ToDouble(adatok[9]);
            compLaps = Convert.ToInt32(adatok[10]);

            stops = Convert.ToInt32(adatok[11]);
            allTyres = adatok[12];

            frontWing = Convert.ToInt32(adatok[13]);
            rearWing = Convert.ToInt32(adatok[14]);
            frontSuspension = Convert.ToInt32(adatok[15]);
            rearSuspension = Convert.ToInt32(adatok[16]);
            frontRideHeight = Convert.ToInt32(adatok[17]);
            rearRideHeight = Convert.ToInt32(adatok[18]);
            frontBrakeBias = Convert.ToInt32(adatok[19]);
            brakePressure = Convert.ToInt32(adatok[20]);
            frontTyrePressure = Convert.ToInt32(adatok[21]);
            rearTyrePressure = Convert.ToInt32(adatok[22]);
        }
        public Driver()
        {
            this.name = "";
        }
    }
}
