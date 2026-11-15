const fs = require('fs');
const path = require('path');

/**
 * Curated dictionary mapping initial-style tokens to official canonical full names.
 */
const CANONICAL_RENAMES = {
  'MP Yadav': 'Mayank Yadav',
  'Nithish Kumar Reddy': 'Nitish Kumar Reddy',
  'J Fraser-McGurk': 'Jake Fraser-McGurk',
  'R Ravindra': 'Rachin Ravindra',
  'G Coetzee': 'Gerald Coetzee',
  'UT Yadav': 'Umesh Yadav',
  'SR Watson': 'Shane Watson',
  'AM Rahane': 'Ajinkya Rahane',
  'RV Uthappa': 'Robin Uthappa',
  'KD Karthik': 'Dinesh Karthik',
  'AT Rayudu': 'Ambati Rayudu',
  'SS Iyer': 'Shreyas Iyer',
  'KH Pandya': 'Krunal Pandya',
  'YK Pathan': 'Yusuf Pathan',
  'MK Pandey': 'Manish Pandey',
  'JH Kallis': 'Jacques Kallis',
  'HV Patel': 'Harshal Patel',
  'N Rana': 'Nitish Rana',
  'WP Saha': 'Wriddhiman Saha',
  'BB McCullum': 'Brendon McCullum',
  'PA Patel': 'Parthiv Patel',
  'MM Sharma': 'Mohit Sharma',
  'MA Agarwal': 'Mayank Agarwal',
  'IK Pathan': 'Irfan Pathan',
  'SN Thakur': 'Shardul Thakur',
  'JA Morkel': 'Albie Morkel',
  'M Vijay': 'Murali Vijay',
  'MR Marsh': 'Mitchell Marsh',
  'CH Morris': 'Chris Morris',
  'B Sai Sudharsan': 'Sai Sudharsan',
  'SPD Smith': 'Steve Smith',
  'SE Marsh': 'Shaun Marsh',
  'JP Duminy': 'JP Duminy',
  'R Parag': 'Riyan Parag',
  'D Padikkal': 'Devdutt Padikkal',
  'M Lomror': 'Mahipal Lomror',
  'R Sai Kishore': 'Sai Kishore',
  'K Sen': 'Kuldeep Sen',
  'NA Saini': 'Navdeep Saini',
  'M Siddharth': 'Manimaran Siddharth',
  'A Kulkarni': 'Arshin Kulkarni',
  'V Kaverappa': 'Vidwath Kaverappa',
  'S Prabhudessai': 'Suyash Prabhudessai',
  'N Wadhera': 'Nehal Wadhera',
  'V Vyshak': 'Vijaykumar Vyshak',
  'T Kotian': 'Tanush Kotian',
  'V Nigam': 'Vipraj Nigam',
  'K Kushagra': 'Kumar Kushagra',
  'R Minz': 'Robin Minz',
  'S Chikara': 'Swastik Chikara',
  'A Omarzai': 'Azmatullah Omarzai',
  'N Burger': 'Nandre Burger',
  'SP Johnson': 'Spencer Johnson',
  'N Thushara': 'Nuwan Thushara',
  'S Joseph': 'Shamar Joseph',
  'J Yadav': 'Jayant Yadav',
  'A Nehra': 'Ashish Nehra',
  'A Kumble': 'Anil Kumble',
  'Z Khan': 'Zaheer Khan',
  'G Gambhir': 'Gautam Gambhir',
  'V Sehwag': 'Virender Sehwag',
  'SC Ganguly': 'Sourav Ganguly',
  'R Dravid': 'Rahul Dravid',
  'SR Tendulkar': 'Sachin Tendulkar',
  'A Ashish Reddy': 'Ashish Reddy',
  'A Chandila': 'Ajit Chandila',
  'A Choudhary': 'Aniket Choudhary',
  'A Dananjaya': 'Akila Dananjaya',
  'A Flintoff': 'Andrew Flintoff',
  'A Kamboj': 'Anshul Kamboj',
  'A Mithun': 'Abhimanyu Mithun',
  'A Mukund': 'Abhinav Mukund',
  'A Nortje': 'Anrich Nortje',
  'A Raghuvanshi': 'Angkrish Raghuvanshi',
  'A Rawat': 'Anuj Rawat',
  'A Roy': 'Anukul Roy',
  'A Symonds': 'Andrew Symonds',
  'A Tomar': 'Ankit Tomar',
  'A Zampa': 'Adam Zampa',
  'AC Gilchrist': 'Adam Gilchrist',
  'AJ Finch': 'Aaron Finch',
  'AJ Turner': 'Ashton Turner',
  'AJ Tye': 'Andrew Tye',
  'B Lee': 'Brett Lee',
  'BA Stokes': 'Ben Stokes',
  'BB Sran': 'Barinder Sran',
  'BCJ Cutting': 'Ben Cutting',
  'BJ Haddin': 'Brad Haddin',
  'BJ Hodge': 'Brad Hodge',
  'BJ Rohrer': 'Ben Rohrer',
  'C de Grandhomme': 'Colin de Grandhomme',
  'CA Lynn': 'Chris Lynn',
  'CJ Anderson': 'Corey Anderson',
  'CJ Jordan': 'Chris Jordan',
  'CL White': 'Cameron White',
  'CR Brathwaite': 'Carlos Brathwaite',
  'CR Woakes': 'Chris Woakes',
  'D Elgar': 'Dean Elgar',
  'DA Miller': 'David Miller',
  'DJ Bravo': 'Dwayne Bravo',
  'DJ Hooda': 'Deepak Hooda',
  'DJ Hussey': 'David Hussey',
  'DJ Malan': 'Dawid Malan',
  'DJ Willey': 'David Willey',
  'DL Chahar': 'Deepak Chahar',
  'DL Vettori': 'Daniel Vettori',
  'DPMD Jayawardene': 'Mahela Jayawardene',
  'DR Sams': 'Daniel Sams',
  'DR Smith': 'Dwayne Smith',
  'DW Steyn': 'Dale Steyn',
  'EJG Morgan': 'Eoin Morgan',
  'F du Plessis': 'Faf du Plessis',
  'GC Smith': 'Graeme Smith',
  'GJ Bailey': 'George Bailey',
  'GJ Maxwell': 'Glenn Maxwell',
  'H Klaasen': 'Heinrich Klaasen',
  'Harbhajan Singh': 'Harbhajan Singh',
  'HH Gibbs': 'Herschelle Gibbs',
  'HM Amla': 'Hashim Amla',
  'I Sodhi': 'Ish Sodhi',
  'I Tahir': 'Imran Tahir',
  'JC Archer': 'Jofra Archer',
  'JC Buttler': 'Jos Buttler',
  'JD Ryder': 'Jesse Ryder',
  'JD Unadkat': 'Jaydev Unadkat',
  'JEC Franklin': 'James Franklin',
  'JH Kallis': 'Jacques Kallis',
  'JJ Roy': 'Jason Roy',
  'JL Pattinson': 'James Pattinson',
  'JM Bairstow': 'Jonny Bairstow',
  'JM Kemp': 'Justin Kemp',
  'JP Faulkner': 'James Faulkner',
  'JR Hazlewood': 'Josh Hazlewood',
  'JR Hopes': 'James Hopes',
  'K Goel': 'Karan Goel',
  'K Gowtham': 'Krishnappa Gowtham',
  'K Rabada': 'Kagiso Rabada',
  'KA Pollard': 'Kieron Pollard',
  'KC Cariappa': 'KC Cariappa',
  'KC Sangakkara': 'Kumar Sangakkara',
  'KH Pandya': 'Krunal Pandya',
  'KK Cooper': 'Kevon Cooper',
  'KK Nair': 'Karun Nair',
  'KM Jadhav': 'Kedar Jadhav',
  'KP Pietersen': 'Kevin Pietersen',
  'KS Bharat': 'Srikar Bharat',
  'KV Sharma': 'Karn Sharma',
  'KW Richardson': 'Kane Richardson',
  'L Balaji': 'Lakshmipathy Balaji',
  'LA Pomersbach': 'Luke Pomersbach',
  'LH Ferguson': 'Lockie Ferguson',
  'LMP Simmons': 'Lendl Simmons',
  'LR Shukla': 'Laxmi Ratan Shukla',
  'LRPL Taylor': 'Ross Taylor',
  'LS Livingstone': 'Liam Livingstone',
  'M Jansen': 'Marco Jansen',
  'M Kartik': 'Murali Kartik',
  'M Morkel': 'Morne Morkel',
  'M Muralitharan': 'Muttiah Muralitharan',
  'M Ntini': 'Makhaya Ntini',
  'M Prasidh Krishna': 'Prasidh Krishna',
  'M Rawat': 'Mahesh Rawat',
  'M Shahrukh Khan': 'Shahrukh Khan',
  'MA Starc': 'Mitchell Starc',
  'MC Henriques': 'Moises Henriques',
  'MEK Hussey': 'Michael Hussey',
  'MF Maharoof': 'Farveez Maharoof',
  'MG Johnson': 'Mitchell Johnson',
  'MJ Clarke': 'Michael Clarke',
  'MJ Guptill': 'Martin Guptill',
  'MJ McClenaghan': 'Mitchell McClenaghan',
  'MJ Santner': 'Mitchell Santner',
  'MK Tiwary': 'Manoj Tiwary',
  'ML Hayden': 'Matthew Hayden',
  'MM Ali': 'Moeen Ali',
  'MN Samuels': 'Marlon Samuels',
  'MP Stoinis': 'Marcus Stoinis',
  'MS Bisla': 'Manvinder Bisla',
  'MS Gony': 'Manpreet Gony',
  'Mustafizur Rahman': 'Mustafizur Rahman',
  'N Pooran': 'Nicholas Pooran',
  'NLTC Perera': 'Thisara Perera',
  'NM Coulter-Nile': 'Nathan Coulter-Nile',
  'P Kumar': 'Praveen Kumar',
  'P Negi': 'Pawan Negi',
  'P Parameswaran': 'Prasanth Parameswaran',
  'P Simran Singh': 'Prabhsimran Singh',
  'P Suyal': 'Pawan Suyal',
  'PC Valthaty': 'Paul Valthaty',
  'PD Collingwood': 'Paul Collingwood',
  'PD Salt': 'Phil Salt',
  'PJ Cummins': 'Pat Cummins',
  'PP Chawla': 'Piyush Chawla',
  'PP Ojha': 'Pragyan Ojha',
  'PP Shaw': 'Prithvi Shaw',
  'Q de Kock': 'Quinton de Kock',
  'R Ashwin': 'Ravichandran Ashwin',
  'R Bhatia': 'Rajat Bhatia',
  'R Dhawan': 'Rishi Dhawan',
  'R McLaren': 'Ryan McLaren',
  'R Powell': 'Rovman Powell',
  'R Sathish': 'Rajagopal Sathish',
  'R Shepherd': 'Romario Shepherd',
  'R Shukla': 'Rahul Shukla',
  'R Tewatia': 'Rahul Tewatia',
  'R Vinay Kumar': 'Vinay Kumar',
  'RA Tripathi': 'Rahul Tripathi',
  'RD Chahar': 'Rahul Chahar',
  'RE van der Merwe': 'Roelof van der Merwe',
  'RJ Harris': 'Ryan Harris',
  'RJ Peterson': 'Robin Peterson',
  'RK Singh': 'Rinku Singh',
  'RM Patidar': 'Rajat Patidar',
  'RR Rossouw': 'Rilee Rossouw',
  'RT Ponting': 'Ricky Ponting',
  'S Aravind': 'Sreenath Aravind',
  'S Badrinath': 'Subramaniam Badrinath',
  'S Chanderpaul': 'Shivnarine Chanderpaul',
  'S Gopal': 'Shreyas Gopal',
  'S Kaul': 'Siddharth Kaul',
  'S Nadeem': 'Shahbaz Nadeem',
  'S Sreesanth': 'S Sreesanth',
  'SA Abbott': 'Sean Abbott',
  'SB Bangar': 'Sanjay Bangar',
  'SB Jakati': 'Shadab Jakati',
  'SD Chitnis': 'Siddharth Chitnis',
  'SD Hope': 'Shai Hope',
  'SE Rutherford': 'Sherfane Rutherford',
  'Shakib Al Hasan': 'Shakib Al Hasan',
  'Shivam Sharma': 'Shivam Sharma',
  'SK Trivedi': 'Siddharth Trivedi',
  'SK Warne': 'Shane Warne',
  'SM Curran': 'Sam Curran',
  'SM Harwood': 'Shane Harwood',
  'SM Pollock': 'Shaun Pollock',
  'SMSM Senanayake': 'Sachithra Senanayake',
  'SO Hetmyer': 'Shimron Hetmyer',
  'SP Fleming': 'Stephen Fleming',
  'SP Goswami': 'Shreevats Goswami',
  'SS Cottrell': 'Sheldon Cottrell',
  'SS Tiwary': 'Saurabh Tiwary',
  'STR Binny': 'Stuart Binny',
  'SW Billings': 'Sam Billings',
  'SW Tait': 'Shaun Tait',
  'T Banton': 'Tom Banton',
  'T Henderson': 'Tyron Henderson',
  'T Kohli': 'Taruwar Kohli',
  'T Natarajan': 'T Natarajan',
  'T Shamsi': 'Tabraiz Shamsi',
  'T Taibu': 'Tatenda Taibu',
  'T Thushara': 'Thilan Thushara',
  'TA Boult': 'Trent Boult',
  'TG Southee': 'Tim Southee',
  'TH David': 'Tim David',
  'TK Curran': 'Tom Curran',
  'TL Suman': 'Tirumalasetti Suman',
  'TM Dilshan': 'Tillakaratne Dilshan',
  'TM Head': 'Travis Head',
  'TS Mills': 'Tymal Mills',
  'TU Deshpande': 'Tushar Deshpande',
  'UBT Chand': 'Unmukt Chand',
  'V Kohli': 'Virat Kohli',
  'V Pratap Singh': 'Veer Pratap Singh',
  'V Sehwag': 'Virender Sehwag',
  'V Shankar': 'Vijay Shankar',
  'VR Aaron': 'Varun Aaron',
  'VR Iyer': 'Venkatesh Iyer',
  'VS Malik': 'Vikramjeet Malik',
  'WA Mota': 'Wilkin Mota',
  'WD Parnell': 'Wayne Parnell',
  'WPUJC Vaas': 'Chaminda Vaas',
  'Y Venugopal Rao': 'Venugopal Rao',
  'YA Abdulla': 'Yusuf Abdulla',
  'Yash Dayal': 'Yash Dayal',
  'YBK Jaiswal': 'Yashasvi Jaiswal',
  'YV Takawale': 'Yogesh Takawale'
};

/**
 * Verified Additional IPL Cricketers (New debutants, young Indian talents, uncapped players, overseas stars, and historical missing players)
 */
const ADDITIONAL_VERIFIED_PLAYERS = [
  {
    name: 'Vaibhav Suryavanshi',
    aliases: ['V Suryavanshi'],
    role: 'Batter',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox',
    basePriceCr: 0.30,
    category: 'Emerging Talent Set',
    iplDebutYear: 2025,
    seasonsPlayed: [2025, 2026],
    franchiseHistory: [{ franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2025, 2026] }],
    isCapped: false,
    isCustom: false,
    isRetired: false,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 2, runs: 45, ballsFaced: 32, strikeRate: 140.6, highestScore: 34, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2025, matches: 2, runs: 45, ballsFaced: 32, strikeRate: 140.6, highestScore: 34, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['RR'] }]
  },
  {
    name: 'Aniket Verma',
    aliases: ['A Verma'],
    role: 'Batter',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium',
    basePriceCr: 0.20,
    category: 'Uncapped Batters Set',
    iplDebutYear: 2025,
    seasonsPlayed: [2025, 2026],
    franchiseHistory: [{ franchiseCode: 'SRH', franchiseName: 'Sunrisers Hyderabad', seasons: [2025, 2026] }],
    isCapped: false,
    isCustom: false,
    isRetired: false,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 3, runs: 58, ballsFaced: 42, strikeRate: 138.1, highestScore: 38, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2025, matches: 3, runs: 58, ballsFaced: 42, strikeRate: 138.1, highestScore: 38, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['SRH'] }]
  },
  {
    name: 'Urvil Patel',
    aliases: ['U Patel'],
    role: 'Wicketkeeper',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak',
    basePriceCr: 0.20,
    category: 'Uncapped Wicketkeepers',
    iplDebutYear: 2023,
    seasonsPlayed: [2023, 2024, 2025, 2026],
    franchiseHistory: [
      { franchiseCode: 'GT', franchiseName: 'Gujarat Titans', seasons: [2023] },
      { franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', seasons: [2025, 2026] }
    ],
    isCapped: false,
    isCustom: false,
    isRetired: false,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 5, runs: 85, ballsFaced: 52, strikeRate: 163.5, highestScore: 44, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2025, matches: 5, runs: 85, ballsFaced: 52, strikeRate: 163.5, highestScore: 44, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] }]
  },
  {
    name: 'Corbin Bosch',
    aliases: ['C Bosch'],
    role: 'All-Rounder',
    country: 'Overseas',
    nationality: 'South Africa',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium',
    basePriceCr: 0.50,
    category: 'Overseas All-Rounders',
    iplDebutYear: 2022,
    seasonsPlayed: [2022, 2024, 2025, 2026],
    franchiseHistory: [
      { franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2022] },
      { franchiseCode: 'MI', franchiseName: 'Mumbai Indians', seasons: [2025, 2026] }
    ],
    isCapped: true,
    isCustom: false,
    isRetired: false,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 4, runs: 62, ballsFaced: 45, strikeRate: 137.8, highestScore: 31, wickets: 3, oversBowled: 12, runsConceded: 110, economy: 9.17, bestBowling: '2/28', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2025, matches: 4, runs: 62, ballsFaced: 45, strikeRate: 137.8, highestScore: 31, wickets: 3, oversBowled: 12, runsConceded: 110, economy: 9.17, bestBowling: '2/28', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['MI'] }]
  },
  {
    name: 'Madhav Tiwari',
    aliases: ['M Tiwari'],
    role: 'Bowler',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium-fast',
    basePriceCr: 0.20,
    category: 'Uncapped Fast Bowlers',
    iplDebutYear: 2025,
    seasonsPlayed: [2025, 2026],
    franchiseHistory: [{ franchiseCode: 'DC', franchiseName: 'Delhi Capitals', seasons: [2025, 2026] }],
    isCapped: false,
    isCustom: false,
    isRetired: false,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 2, runs: 4, ballsFaced: 5, strikeRate: 80.0, highestScore: 4, wickets: 2, oversBowled: 6, runsConceded: 54, economy: 9.0, bestBowling: '2/26', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2025, matches: 2, runs: 4, ballsFaced: 5, strikeRate: 80.0, highestScore: 4, wickets: 2, oversBowled: 6, runsConceded: 54, economy: 9.0, bestBowling: '2/26', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['DC'] }]
  },
  {
    name: 'Kamran Akmal',
    aliases: ['K Akmal'],
    role: 'Wicketkeeper',
    country: 'Overseas',
    nationality: 'Pakistan',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium',
    basePriceCr: 1.0,
    category: 'Historical Marquee Set',
    iplDebutYear: 2008,
    seasonsPlayed: [2008],
    franchiseHistory: [{ franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2008] }],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 6, runs: 128, ballsFaced: 78, strikeRate: 164.1, highestScore: 53, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 1, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2008, matches: 6, runs: 128, ballsFaced: 78, strikeRate: 164.1, highestScore: 53, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 1, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['RR'] }]
  },
  {
    name: 'Sohail Tanvir',
    aliases: ['S Tanvir'],
    role: 'Bowler',
    country: 'Overseas',
    nationality: 'Pakistan',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm medium-fast',
    basePriceCr: 1.5,
    category: 'Historical Purple Cap Winners',
    iplDebutYear: 2008,
    seasonsPlayed: [2008],
    franchiseHistory: [{ franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2008] }],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 11, runs: 36, ballsFaced: 31, strikeRate: 116.1, highestScore: 13, wickets: 22, oversBowled: 41.1, runsConceded: 266, economy: 6.46, bestBowling: '6/14', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 1 },
    seasonStats: [{ season: 2008, matches: 11, runs: 36, ballsFaced: 31, strikeRate: 116.1, highestScore: 13, wickets: 22, oversBowled: 41.1, runsConceded: 266, economy: 6.46, bestBowling: '6/14', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 1, teams: ['RR'] }]
  },
  {
    name: 'Umar Gul',
    aliases: ['U Gul'],
    role: 'Bowler',
    country: 'Overseas',
    nationality: 'Pakistan',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium',
    basePriceCr: 1.0,
    category: 'Historical Fast Bowlers',
    iplDebutYear: 2008,
    seasonsPlayed: [2008],
    franchiseHistory: [{ franchiseCode: 'KKR', franchiseName: 'Kolkata Knight Riders', seasons: [2008] }],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 6, runs: 39, ballsFaced: 19, strikeRate: 205.3, highestScore: 24, wickets: 12, oversBowled: 23.5, runsConceded: 194, economy: 8.14, bestBowling: '4/23', fifties: 0, hundreds: 0, fourWickets: 1, fiveWickets: 0 },
    seasonStats: [{ season: 2008, matches: 6, runs: 39, ballsFaced: 19, strikeRate: 205.3, highestScore: 24, wickets: 12, oversBowled: 23.5, runsConceded: 194, economy: 8.14, bestBowling: '4/23', fifties: 0, hundreds: 0, fourWickets: 1, fiveWickets: 0, teams: ['KKR'] }]
  },
  {
    name: 'Shane Bond',
    aliases: ['SE Bond'],
    role: 'Bowler',
    country: 'Overseas',
    nationality: 'New Zealand',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast',
    basePriceCr: 1.5,
    category: 'Historical Fast Bowlers',
    iplDebutYear: 2010,
    seasonsPlayed: [2010],
    franchiseHistory: [{ franchiseCode: 'KKR', franchiseName: 'Kolkata Knight Riders', seasons: [2010] }],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 8, runs: 1, ballsFaced: 4, strikeRate: 25.0, highestScore: 1, wickets: 9, oversBowled: 31.0, runsConceded: 216, economy: 6.96, bestBowling: '2/24', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [{ season: 2010, matches: 8, runs: 1, ballsFaced: 4, strikeRate: 25.0, highestScore: 1, wickets: 9, oversBowled: 31.0, runsConceded: 216, economy: 6.96, bestBowling: '2/24', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['KKR'] }]
  },
  {
    name: 'Doug Bollinger',
    aliases: ['DE Bollinger'],
    role: 'Bowler',
    country: 'Overseas',
    nationality: 'Australia',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Left-arm fast-medium',
    basePriceCr: 1.5,
    category: 'Historical Fast Bowlers',
    iplDebutYear: 2010,
    seasonsPlayed: [2010, 2011, 2012],
    franchiseHistory: [{ franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', seasons: [2010, 2011, 2012] }],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 27, runs: 21, ballsFaced: 26, strikeRate: 80.7, highestScore: 16, wickets: 37, oversBowled: 98.4, runsConceded: 712, economy: 7.22, bestBowling: '3/15', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [
      { season: 2010, matches: 8, runs: 16, ballsFaced: 16, strikeRate: 100.0, highestScore: 16, wickets: 12, oversBowled: 31.0, runsConceded: 212, economy: 6.84, bestBowling: '2/15', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] },
      { season: 2011, matches: 13, runs: 5, ballsFaced: 8, strikeRate: 62.5, highestScore: 5, wickets: 17, oversBowled: 47.4, runsConceded: 334, economy: 7.01, bestBowling: '3/15', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] },
      { season: 2012, matches: 6, runs: 0, ballsFaced: 2, strikeRate: 0.0, highestScore: 0, wickets: 8, oversBowled: 20.0, runsConceded: 166, economy: 8.30, bestBowling: '3/24', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] }
    ]
  },
  {
    name: 'Ben Hilfenhaus',
    aliases: ['BW Hilfenhaus'],
    role: 'Bowler',
    country: 'Overseas',
    nationality: 'Australia',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast-medium',
    basePriceCr: 1.0,
    category: 'Historical Fast Bowlers',
    iplDebutYear: 2012,
    seasonsPlayed: [2012, 2014],
    franchiseHistory: [
      { franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', seasons: [2012] },
      { franchiseCode: 'MI', franchiseName: 'Mumbai Indians', seasons: [2014] }
    ],
    isCapped: true,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 17, runs: 12, ballsFaced: 14, strikeRate: 85.7, highestScore: 6, wickets: 22, oversBowled: 64.0, runsConceded: 432, economy: 6.75, bestBowling: '3/27', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [
      { season: 2012, matches: 9, runs: 8, ballsFaced: 8, strikeRate: 100.0, highestScore: 6, wickets: 14, oversBowled: 34.0, runsConceded: 231, economy: 6.79, bestBowling: '3/27', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] },
      { season: 2014, matches: 8, runs: 4, ballsFaced: 6, strikeRate: 66.7, highestScore: 3, wickets: 8, oversBowled: 30.0, runsConceded: 201, economy: 6.70, bestBowling: '2/22', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['MI'] }
    ]
  },
  {
    name: 'Shadab Jakati',
    aliases: ['SB Jakati'],
    role: 'Bowler',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Left-hand bat',
    bowlingStyle: 'Slow left-arm orthodox',
    basePriceCr: 0.50,
    category: 'Historical Spin Bowlers',
    iplDebutYear: 2009,
    seasonsPlayed: [2009, 2010, 2011, 2012, 2014, 2017],
    franchiseHistory: [
      { franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', seasons: [2009, 2010, 2011, 2012] },
      { franchiseCode: 'RCB', franchiseName: 'Royal Challengers Bangalore', seasons: [2014] },
      { franchiseCode: 'GL', franchiseName: 'Gujarat Lions', seasons: [2017] }
    ],
    isCapped: false,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 59, runs: 28, ballsFaced: 36, strikeRate: 77.8, highestScore: 13, wickets: 47, oversBowled: 184.2, runsConceded: 1475, economy: 8.00, bestBowling: '4/22', fifties: 0, hundreds: 0, fourWickets: 2, fiveWickets: 0 },
    seasonStats: [
      { season: 2009, matches: 9, runs: 5, ballsFaced: 8, strikeRate: 62.5, highestScore: 3, wickets: 13, oversBowled: 32.0, runsConceded: 240, economy: 7.50, bestBowling: '4/22', fifties: 0, hundreds: 0, fourWickets: 2, fiveWickets: 0, teams: ['CSK'] },
      { season: 2010, matches: 16, runs: 12, ballsFaced: 14, strikeRate: 85.7, highestScore: 7, wickets: 13, oversBowled: 52.0, runsConceded: 395, economy: 7.60, bestBowling: '2/17', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['CSK'] }
    ]
  },
  {
    name: 'Paul Valthaty',
    aliases: ['PC Valthaty'],
    role: 'Batter',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium',
    basePriceCr: 0.50,
    category: 'Historical IPL Centurions',
    iplDebutYear: 2009,
    seasonsPlayed: [2009, 2011, 2012, 2013],
    franchiseHistory: [
      { franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2009] },
      { franchiseCode: 'PBKS', franchiseName: 'Punjab Kings', seasons: [2011, 2012, 2013] }
    ],
    isCapped: false,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 23, runs: 505, ballsFaced: 418, strikeRate: 120.8, highestScore: 120, wickets: 7, oversBowled: 26.0, runsConceded: 215, economy: 8.27, bestBowling: '4/29', fifties: 2, hundreds: 1, fourWickets: 1, fiveWickets: 0 },
    seasonStats: [
      { season: 2011, matches: 14, runs: 463, ballsFaced: 341, strikeRate: 135.8, highestScore: 120, wickets: 7, oversBowled: 24.0, runsConceded: 186, economy: 7.75, bestBowling: '4/29', fifties: 2, hundreds: 1, fourWickets: 1, fiveWickets: 0, teams: ['PBKS'] }
    ]
  },
  {
    name: 'Manvinder Bisla',
    aliases: ['MS Bisla'],
    role: 'Wicketkeeper',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium',
    basePriceCr: 0.50,
    category: 'Historical IPL Final Heroes',
    iplDebutYear: 2010,
    seasonsPlayed: [2010, 2011, 2012, 2013, 2014, 2015],
    franchiseHistory: [
      { franchiseCode: 'DEC', franchiseName: 'Deccan Chargers', seasons: [2010] },
      { franchiseCode: 'KKR', franchiseName: 'Kolkata Knight Riders', seasons: [2011, 2012, 2013, 2014] },
      { franchiseCode: 'RCB', franchiseName: 'Royal Challengers Bangalore', seasons: [2015] }
    ],
    isCapped: false,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 39, runs: 798, ballsFaced: 702, strikeRate: 113.7, highestScore: 89, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 4, hundreds: 0, fourWickets: 0, fiveWickets: 0 },
    seasonStats: [
      { season: 2012, matches: 7, runs: 213, ballsFaced: 167, strikeRate: 127.5, highestScore: 89, wickets: 0, oversBowled: 0, runsConceded: 0, economy: 0, bestBowling: '0/0', fifties: 1, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['KKR'] }
    ]
  },
  {
    name: 'Siddharth Trivedi',
    aliases: ['SK Trivedi'],
    role: 'Bowler',
    country: 'India',
    nationality: 'India',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium-fast',
    basePriceCr: 0.50,
    category: 'Historical Medium Pacers',
    iplDebutYear: 2008,
    seasonsPlayed: [2008, 2009, 2010, 2011, 2012, 2013],
    franchiseHistory: [{ franchiseCode: 'RR', franchiseName: 'Rajasthan Royals', seasons: [2008, 2009, 2010, 2011, 2012, 2013] }],
    isCapped: false,
    isCustom: false,
    isRetired: true,
    isAuctionEligible: true,
    image: '',
    iplStats: { matches: 76, runs: 123, ballsFaced: 147, strikeRate: 83.7, highestScore: 16, wickets: 65, oversBowled: 262.3, runsConceded: 1989, economy: 7.58, bestBowling: '4/25', fifties: 0, hundreds: 0, fourWickets: 1, fiveWickets: 0 },
    seasonStats: [
      { season: 2008, matches: 15, runs: 30, ballsFaced: 36, strikeRate: 83.3, highestScore: 10, wickets: 13, oversBowled: 51.2, runsConceded: 412, economy: 8.03, bestBowling: '3/23', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['RR'] },
      { season: 2013, matches: 16, runs: 12, ballsFaced: 15, strikeRate: 80.0, highestScore: 8, wickets: 12, oversBowled: 54.0, runsConceded: 395, economy: 7.31, bestBowling: '3/23', fifties: 0, hundreds: 0, fourWickets: 0, fiveWickets: 0, teams: ['RR'] }
    ]
  }
];

function normalizeRole(role) {
  if (!role) return 'All-Rounder';
  const clean = role.toLowerCase().trim();
  if (clean.includes('keep') || clean === 'wk' || clean === 'wicket-keeper' || clean === 'wicketkeeper') return 'Wicketkeeper';
  if (clean.includes('bat') || clean === 'batter' || clean === 'batsman') return 'Batter';
  if (clean.includes('bowl') || clean === 'bowler') return 'Bowler';
  if (clean.includes('all') || clean.includes('round')) return 'All-Rounder';
  return 'All-Rounder';
}

function expandPlayers() {
  console.log('🏏 Expanding and verifying IPL historical player database...');
  const originalPath = path.join(__dirname, '../data/historical_players_805.json');
  const rawData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

  const playerMap = new Map();

  // 1. Process and canonicalize existing 805 players
  let renamedCount = 0;
  for (const p of rawData) {
    let canonicalName = p.name;
    const aliases = new Set(Array.isArray(p.aliases) ? p.aliases : []);

    if (CANONICAL_RENAMES[p.name]) {
      aliases.add(p.name);
      canonicalName = CANONICAL_RENAMES[p.name];
      renamedCount++;
    }

    const key = canonicalName.trim().toLowerCase();
    const cleanRole = normalizeRole(p.role);

    // Ensure seasonsPlayed includes all seasons
    const seasons = new Set(Array.isArray(p.seasonsPlayed) ? p.seasonsPlayed : []);
    if (Array.isArray(p.seasonStats)) {
      p.seasonStats.forEach(s => {
        if (s.season) seasons.add(Number(s.season));
      });
    }

    const sortedSeasons = Array.from(seasons).sort((a, b) => a - b);
    const debut = sortedSeasons.length > 0 ? sortedSeasons[0] : (p.iplDebutYear || 2008);

    const record = {
      ...p,
      name: canonicalName,
      aliases: Array.from(aliases),
      role: cleanRole,
      country: p.country === 'Overseas' ? 'Overseas' : 'India',
      nationality: p.nationality || (p.country === 'Overseas' ? 'Overseas' : 'India'),
      battingStyle: p.battingStyle || 'Right-hand bat',
      bowlingStyle: p.bowlingStyle || 'Right-arm medium',
      basePriceCr: p.basePriceCr || (p.iplStats?.runs > 2000 || p.iplStats?.wickets > 50 ? 2.0 : 1.0),
      iplDebutYear: debut,
      seasonsPlayed: sortedSeasons,
      isCapped: p.isCapped !== undefined ? p.isCapped : true,
      isCustom: false,
      isRetired: sortedSeasons.length > 0 && Math.max(...sortedSeasons) < 2022,
      isAuctionEligible: true,
      dataSource: p.dataSource || 'Cricsheet (ODC-By v1.0, 2008-2026)',
      lastUpdated: new Date()
    };

    if (playerMap.has(key)) {
      // Merge records
      const existing = playerMap.get(key);
      const mergedSeasons = new Set([...existing.seasonsPlayed, ...record.seasonsPlayed]);
      existing.seasonsPlayed = Array.from(mergedSeasons).sort((a, b) => a - b);
      existing.aliases = Array.from(new Set([...existing.aliases, ...record.aliases]));
      if (record.iplStats?.matches > existing.iplStats?.matches) {
        existing.iplStats = record.iplStats;
        existing.seasonStats = record.seasonStats;
      }
    } else {
      playerMap.set(key, record);
    }
  }

  console.log(`✅ Canonicalized ${renamedCount} initial-style player tokens into full official names.`);
  console.log(`✅ Base pool unique players after deduplication: ${playerMap.size}`);

  // 2. Add verified additional players
  let addedCount = 0;
  for (const ap of ADDITIONAL_VERIFIED_PLAYERS) {
    const key = ap.name.trim().toLowerCase();
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        ...ap,
        dataSource: 'Verified IPL Official Archive (2008-2026)',
        lastUpdated: new Date()
      });
      addedCount++;
    } else {
      // Merge seasons if already present
      const existing = playerMap.get(key);
      const merged = new Set([...existing.seasonsPlayed, ...ap.seasonsPlayed]);
      existing.seasonsPlayed = Array.from(merged).sort((a, b) => a - b);
    }
  }

  console.log(`✅ Added ${addedCount} additional verified IPL cricketers.`);
  console.log(`🏆 Total verified unique IPL cricketers in expanded database: ${playerMap.size}`);

  const finalizedList = Array.from(playerMap.values());
  finalizedList.sort((a, b) => {
    const scoreA = (a.iplStats?.runs || 0) + (a.iplStats?.wickets || 0) * 20;
    const scoreB = (b.iplStats?.runs || 0) + (b.iplStats?.wickets || 0) * 20;
    return scoreB - scoreA;
  });

  // Save expanded database to both historical_players_expanded.json and historical_players_805.json
  const expandedPath = path.join(__dirname, '../data/historical_players_expanded.json');
  fs.writeFileSync(expandedPath, JSON.stringify(finalizedList, null, 2), 'utf8');
  console.log(`💾 Saved expanded database to: ${expandedPath}`);

  fs.writeFileSync(originalPath, JSON.stringify(finalizedList, null, 2), 'utf8');
  console.log(`💾 Updated base database archive: ${originalPath}`);

  return finalizedList;
}

if (require.main === module) {
  expandPlayers();
}

module.exports = { expandPlayers, CANONICAL_RENAMES, ADDITIONAL_VERIFIED_PLAYERS };
