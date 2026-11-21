using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Pause_Resume
{
    class Tracks
    {
        public int ID;
        public string location;
        public int laps;
        public int optLapTime;
        public double ovtkMultiplier;
        public int optDownForce;
        public int optCarBalance;
        public int optTraction;
        public int optBreakBalance;
        public int optTopSpeed;


        public Tracks(string sor)
        {
            string[] adatok = sor.Split(';');
            ID = Convert.ToInt32(adatok[0]);
            location = adatok[1];
            laps = Convert.ToInt32(adatok[2]);
            optLapTime = Convert.ToInt32(adatok[3]);
            ovtkMultiplier = Convert.ToDouble(adatok[4]);
            optDownForce = Convert.ToInt32(adatok[5]);
            optCarBalance = Convert.ToInt32(adatok[6]);
            optTraction = Convert.ToInt32(adatok[7]);
            optBreakBalance = Convert.ToInt32(adatok[8]);
            optTopSpeed = Convert.ToInt32(adatok[9]);
        }
    }
}
