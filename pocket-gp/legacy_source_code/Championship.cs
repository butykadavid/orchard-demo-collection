using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Pause_Resume
{
    class Championship
    {
        public string name;
        public string teamName;
        public int points;

        public Championship(string sor)
        {
            string[] adatok = sor.Split(';');
            name = adatok[0];
            teamName = adatok[1];
            points = Convert.ToInt32(adatok[2]);
        }
    }
}
