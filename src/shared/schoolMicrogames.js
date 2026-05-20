import {
  createSchoolGeographyCountry,
  createSchoolGeographyCountryChoices
} from './geographyCountries.js';

export const SCHOOL_MICROGAME_IDS = Object.freeze({
  popQuiz: 'pop-quiz-panic',
  popQuizPanic: 'pop-quiz-panic',
  geography: 'geography-globe',
  geographyGlobe: 'geography-globe',
  lockerCombo: 'locker-combo',
  copyNotes: 'copy-the-notes',
  copyTheNotes: 'copy-the-notes',
  teacherLooking: 'teacher-is-looking',
  teacherIsLooking: 'teacher-is-looking',
  memoryMatch: 'memory-match',
  memoryCards: 'memory-match',
  dodgeChalk: 'dodge-the-chalk',
  dodgeTheChalk: 'dodge-the-chalk',
  sortBackpack: 'sort-the-backpack',
  sortTheBackpack: 'sort-the-backpack',
  bellSprint: 'bell-sprint',
  scantron: 'scantron-speedrun',
  scantronSpeedrun: 'scantron-speedrun'
});

export const SCHOOL_MICROGAME_DEFAULT_ID = SCHOOL_MICROGAME_IDS.popQuizPanic;
export const SCHOOL_MICROGAME_ALL_ID = 'all';
export const SCHOOL_MICROGAME_DEFAULT_REWARD_XP = 8;
export const SCHOOL_MICROGAME_DEFAULT_REWARD_MONEY = 0;
export const SCHOOL_POP_QUIZ_ROUND_COUNT = 3;

const QUESTION_BANK = Object.freeze([
  Object.freeze({ question: 'What is 9 x 7?', answers: Object.freeze(['54', '63', '72']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a noun?', answers: Object.freeze(['Quickly', 'Locker', 'Blue']), correctIndex: 1 }),
  Object.freeze({ question: 'What planet is known as the red planet?', answers: Object.freeze(['Mars', 'Venus', 'Jupiter']), correctIndex: 0 }),
  Object.freeze({ question: 'Solve: 18 + 24', answers: Object.freeze(['32', '42', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'Which is a complete sentence?', answers: Object.freeze(['Ran fast', 'Because lunch', 'The bell rang']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 12 x 6?', answers: Object.freeze(['66', '72', '78']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a verb?', answers: Object.freeze(['Jump', 'Pencil', 'Quiet']), correctIndex: 0 }),
  Object.freeze({ question: 'How many sides does a hexagon have?', answers: Object.freeze(['5', '6', '8']), correctIndex: 1 }),
  Object.freeze({ question: 'What gas do plants take in?', answers: Object.freeze(['Oxygen', 'Nitrogen', 'Carbon dioxide']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 144 divided by 12?', answers: Object.freeze(['10', '12', '14']), correctIndex: 1 }),
  Object.freeze({ question: 'Which punctuation ends a question?', answers: Object.freeze(['Period', 'Comma', 'Question mark']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the largest ocean?', answers: Object.freeze(['Atlantic', 'Pacific', 'Indian']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 15 percent of 100?', answers: Object.freeze(['10', '15', '25']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word means the opposite of ancient?', answers: Object.freeze(['Modern', 'Fragile', 'Silent']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the square root of 81?', answers: Object.freeze(['8', '9', '10']), correctIndex: 1 }),
  Object.freeze({ question: 'Which animal is a mammal?', answers: Object.freeze(['Shark', 'Frog', 'Whale']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 3/4 as a decimal?', answers: Object.freeze(['0.25', '0.5', '0.75']), correctIndex: 2 }),
  Object.freeze({ question: 'Which sentence uses their correctly?', answers: Object.freeze(['Their books fell', 'There books fell', 'Theyre books fell']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the capital of California?', answers: Object.freeze(['Sacramento', 'Los Angeles', 'San Diego']), correctIndex: 0 }),
  Object.freeze({ question: 'Which planet is closest to the sun?', answers: Object.freeze(['Venus', 'Mercury', 'Earth']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 27 + 38?', answers: Object.freeze(['55', '65', '75']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is an adjective?', answers: Object.freeze(['Bright', 'Running', 'Desk']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the past tense of teach?', answers: Object.freeze(['Teached', 'Taught', 'Teaching']), correctIndex: 1 }),
  Object.freeze({ question: 'How many minutes are in two hours?', answers: Object.freeze(['60', '90', '120']), correctIndex: 2 }),
  Object.freeze({ question: 'Which layer of Earth is liquid metal?', answers: Object.freeze(['Crust', 'Outer core', 'Mantle']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 11 squared?', answers: Object.freeze(['111', '121', '131']), correctIndex: 1 }),
  Object.freeze({ question: 'Which number is prime?', answers: Object.freeze(['21', '29', '35']), correctIndex: 1 }),
  Object.freeze({ question: 'What do bees collect from flowers?', answers: Object.freeze(['Nectar', 'Granite', 'Salt']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is a synonym for quick?', answers: Object.freeze(['Rapid', 'Heavy', 'Empty']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 5 cubed?', answers: Object.freeze(['25', '75', '125']), correctIndex: 2 }),
  Object.freeze({ question: 'Which branch makes federal laws?', answers: Object.freeze(['Judicial', 'Legislative', 'Executive']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the chemical symbol for water?', answers: Object.freeze(['CO2', 'H2O', 'O2']), correctIndex: 1 }),
  Object.freeze({ question: 'Which continent is Brazil in?', answers: Object.freeze(['Africa', 'South America', 'Europe']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 90 degrees called?', answers: Object.freeze(['Acute angle', 'Right angle', 'Obtuse angle']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is plural?', answers: Object.freeze(['Class', 'Boxes', 'Child']), correctIndex: 1 }),
  Object.freeze({ question: 'What force pulls objects toward Earth?', answers: Object.freeze(['Gravity', 'Friction', 'Magnetism']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 64 minus 27?', answers: Object.freeze(['37', '41', '47']), correctIndex: 0 }),
  Object.freeze({ question: 'Which is a primary color?', answers: Object.freeze(['Green', 'Purple', 'Red']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the main idea of a paragraph?', answers: Object.freeze(['The central point', 'The page number', 'The longest word']), correctIndex: 0 }),
  Object.freeze({ question: 'Which shape has four equal sides?', answers: Object.freeze(['Triangle', 'Square', 'Pentagon']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 7 x 8?', answers: Object.freeze(['54', '56', '64']), correctIndex: 1 }),
  Object.freeze({ question: 'Which organ pumps blood?', answers: Object.freeze(['Heart', 'Liver', 'Lung']), correctIndex: 0 }),
  Object.freeze({ question: 'What is half of 86?', answers: Object.freeze(['41', '43', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is spelled correctly?', answers: Object.freeze(['Recieve', 'Receive', 'Receeve']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the freezing point of water in C?', answers: Object.freeze(['0', '32', '100']), correctIndex: 0 }),
  Object.freeze({ question: 'Who wrote the Declaration of Independence?', answers: Object.freeze(['Thomas Jefferson', 'Abraham Lincoln', 'George Washington']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 1,000 divided by 10?', answers: Object.freeze(['10', '100', '1,000']), correctIndex: 1 }),
  Object.freeze({ question: 'Which sentence has correct capitalization?', answers: Object.freeze(['i like math', 'I like math', 'I Like Math']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the perimeter of a 4 by 6 rectangle?', answers: Object.freeze(['10', '20', '24']), correctIndex: 1 }),
  Object.freeze({ question: 'Which simple machine is a ramp?', answers: Object.freeze(['Lever', 'Pulley', 'Inclined plane']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the antonym of generous?', answers: Object.freeze(['Stingy', 'Helpful', 'Friendly']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 13 + 19 + 8?', answers: Object.freeze(['38', '40', '42']), correctIndex: 1 }),
  Object.freeze({ question: 'Which planet has rings most famously?', answers: Object.freeze(['Mars', 'Saturn', 'Mercury']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a contraction?', answers: Object.freeze(['Cannot', 'Cant', "Can't"]), correctIndex: 2 }),
  Object.freeze({ question: 'What is 6 x 12?', answers: Object.freeze(['62', '72', '82']), correctIndex: 1 }),
  Object.freeze({ question: 'Which fraction equals 0.5?', answers: Object.freeze(['1/2', '1/3', '2/3']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 8 x 9?', answers: Object.freeze(['63', '72', '81']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 45 divided by 5?', answers: Object.freeze(['8', '9', '10']), correctIndex: 1 }),
  Object.freeze({ question: 'Solve: 16 + 27', answers: Object.freeze(['41', '43', '45']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 100 minus 37?', answers: Object.freeze(['53', '63', '73']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 14 x 3?', answers: Object.freeze(['38', '42', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 81 divided by 9?', answers: Object.freeze(['7', '8', '9']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 2 to the 5th power?', answers: Object.freeze(['16', '25', '32']), correctIndex: 2 }),
  Object.freeze({ question: 'Which fraction equals 0.25?', answers: Object.freeze(['1/2', '1/4', '3/4']), correctIndex: 1 }),
  Object.freeze({ question: 'How many items are in three dozen?', answers: Object.freeze(['24', '36', '48']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the area of a 5 by 6 rectangle?', answers: Object.freeze(['11', '22', '30']), correctIndex: 2 }),
  Object.freeze({ question: 'What is one third of 27?', answers: Object.freeze(['6', '9', '12']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 2.5 + 1.5?', answers: Object.freeze(['3', '4', '5']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 9 x 9?', answers: Object.freeze(['72', '81', '90']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 120 divided by 4?', answers: Object.freeze(['20', '30', '40']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the median of 3, 7, and 9?', answers: Object.freeze(['3', '7', '9']), correctIndex: 1 }),
  Object.freeze({ question: 'Which value is an integer?', answers: Object.freeze(['4.5', '7', '1/2']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 25 percent of 200?', answers: Object.freeze(['25', '50', '75']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 6 squared?', answers: Object.freeze(['12', '30', '36']), correctIndex: 2 }),
  Object.freeze({ question: 'Which number is even?', answers: Object.freeze(['17', '24', '31']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 13 x 4?', answers: Object.freeze(['42', '52', '62']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 99 + 1?', answers: Object.freeze(['90', '100', '101']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 72 minus 18?', answers: Object.freeze(['44', '54', '64']), correctIndex: 1 }),
  Object.freeze({ question: 'Which comparison is true?', answers: Object.freeze(['7 > 9', '12 < 10', '15 > 13']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the next number: 2, 4, 8, 16?', answers: Object.freeze(['24', '30', '32']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 1 kilometer in meters?', answers: Object.freeze(['10', '100', '1,000']), correctIndex: 2 }),
  Object.freeze({ question: 'Which prefix means before?', answers: Object.freeze(['Pre', 'Post', 'Sub']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is a synonym for happy?', answers: Object.freeze(['Joyful', 'Nervous', 'Bitter']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is the antonym of shallow?', answers: Object.freeze(['Deep', 'Narrow', 'Smooth']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is an adverb?', answers: Object.freeze(['Softly', 'Table', 'Green']), correctIndex: 0 }),
  Object.freeze({ question: 'Which punctuation separates items in a list?', answers: Object.freeze(['Comma', 'Colon', 'Dash']), correctIndex: 0 }),
  Object.freeze({ question: 'What marks the exact words someone says?', answers: Object.freeze(['Quotation marks', 'Parentheses', 'Hyphens']), correctIndex: 0 }),
  Object.freeze({ question: "What does the apostrophe in don't show?", answers: Object.freeze(['A missing letter', 'A plural word', 'A question']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the subject in: The student reads?', answers: Object.freeze(['Student', 'Reads', 'The']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is a homophone for one?', answers: Object.freeze(['Won', 'Own', 'Open']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is a proper noun?', answers: Object.freeze(['River', 'Tuesday', 'Mountain']), correctIndex: 1 }),
  Object.freeze({ question: 'Which sentence is in future tense?', answers: Object.freeze(['I walked', 'I walk', 'I will walk']), correctIndex: 2 }),
  Object.freeze({ question: 'Which word is possessive?', answers: Object.freeze(["Teacher's", 'Teachers', 'Teaching']), correctIndex: 0 }),
  Object.freeze({ question: 'What is a group of lines in a poem called?', answers: Object.freeze(['Stanza', 'Chapter', 'Index']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word best completes: She ___ to class?', answers: Object.freeze(['Go', 'Goes', 'Going']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is an interjection?', answers: Object.freeze(['Wow', 'Chair', 'Walked']), correctIndex: 0 }),
  Object.freeze({ question: 'Which sentence is a command?', answers: Object.freeze(['Close the door', 'The door is blue', 'Why is it open']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the process plants use to make food?', answers: Object.freeze(['Photosynthesis', 'Evaporation', 'Condensation']), correctIndex: 0 }),
  Object.freeze({ question: 'What is liquid changing into gas called?', answers: Object.freeze(['Melting', 'Evaporation', 'Freezing']), correctIndex: 1 }),
  Object.freeze({ question: 'What is solid changing into liquid called?', answers: Object.freeze(['Melting', 'Condensing', 'Depositing']), correctIndex: 0 }),
  Object.freeze({ question: 'Earth revolves around what?', answers: Object.freeze(['The sun', 'The moon', 'Mars']), correctIndex: 0 }),
  Object.freeze({ question: 'The moon shines mostly because it reflects what?', answers: Object.freeze(['Sunlight', 'City lights', 'Lightning']), correctIndex: 0 }),
  Object.freeze({ question: 'What system supports the body with bones?', answers: Object.freeze(['Skeletal', 'Digestive', 'Nervous']), correctIndex: 0 }),
  Object.freeze({ question: 'What force slows sliding objects?', answers: Object.freeze(['Friction', 'Gravity', 'Electricity']), correctIndex: 0 }),
  Object.freeze({ question: 'Who studies weather?', answers: Object.freeze(['Meteorologist', 'Cartographer', 'Archaeologist']), correctIndex: 0 }),
  Object.freeze({ question: 'At sea level, water boils at what Celsius temperature?', answers: Object.freeze(['0', '50', '100']), correctIndex: 2 }),
  Object.freeze({ question: 'What element has the symbol O?', answers: Object.freeze(['Gold', 'Oxygen', 'Iron']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the center of an atom called?', answers: Object.freeze(['Nucleus', 'Crust', 'Orbit']), correctIndex: 0 }),
  Object.freeze({ question: 'What does a simple circuit need to work?', answers: Object.freeze(['Closed path', 'Broken wire', 'Open switch']), correctIndex: 0 }),
  Object.freeze({ question: 'Which material is a good conductor?', answers: Object.freeze(['Copper', 'Rubber', 'Plastic']), correctIndex: 0 }),
  Object.freeze({ question: 'Which is a renewable energy source?', answers: Object.freeze(['Sunlight', 'Coal', 'Gasoline']), correctIndex: 0 }),
  Object.freeze({ question: 'What part of a plant absorbs water?', answers: Object.freeze(['Roots', 'Flower', 'Stem tip']), correctIndex: 0 }),
  Object.freeze({ question: 'Which state of matter keeps its own shape?', answers: Object.freeze(['Solid', 'Liquid', 'Gas']), correctIndex: 0 }),
  Object.freeze({ question: 'What tool measures temperature?', answers: Object.freeze(['Thermometer', 'Ruler', 'Compass']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the first stage of the water cycle?', answers: Object.freeze(['Evaporation', 'Subtraction', 'Multiplication']), correctIndex: 0 }),
  Object.freeze({ question: 'Who was the first U.S. president?', answers: Object.freeze(['George Washington', 'Thomas Edison', 'Benjamin Franklin']), correctIndex: 0 }),
  Object.freeze({ question: 'How many states are in the United States?', answers: Object.freeze(['48', '50', '52']), correctIndex: 1 }),
  Object.freeze({ question: 'What does a map legend explain?', answers: Object.freeze(['Symbols', 'Lunch menus', 'Book chapters']), correctIndex: 0 }),
  Object.freeze({ question: 'Which direction is between north and east?', answers: Object.freeze(['Northwest', 'Northeast', 'Southeast']), correctIndex: 1 }),
  Object.freeze({ question: 'Which continent is Egypt in?', answers: Object.freeze(['Africa', 'Asia', 'Europe']), correctIndex: 0 }),
  Object.freeze({ question: 'Which country is directly north of the United States?', answers: Object.freeze(['Canada', 'Mexico', 'Brazil']), correctIndex: 0 }),
  Object.freeze({ question: 'What do we call goods brought into a country?', answers: Object.freeze(['Imports', 'Exports', 'Budgets']), correctIndex: 0 }),
  Object.freeze({ question: 'Which document begins with We the People?', answers: Object.freeze(['U.S. Constitution', 'Bill of Sale', 'Class Schedule']), correctIndex: 0 }),
  Object.freeze({ question: 'Which branch interprets laws?', answers: Object.freeze(['Judicial', 'Executive', 'Legislative']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the study of Earth places called?', answers: Object.freeze(['Geography', 'Geometry', 'Grammar']), correctIndex: 0 }),
  Object.freeze({ question: 'Which is a city, state, and country order?', answers: Object.freeze(['Boston, MA, USA', 'USA, Boston, MA', 'MA, USA, Boston']), correctIndex: 0 }),
  Object.freeze({ question: 'Binary code mainly uses which digits?', answers: Object.freeze(['0 and 1', '2 and 3', '8 and 9']), correctIndex: 0 }),
  Object.freeze({ question: 'Which key usually makes a capital letter?', answers: Object.freeze(['Shift', 'Space', 'Tab']), correctIndex: 0 }),
  Object.freeze({ question: 'What does a URL point to?', answers: Object.freeze(['Web address', 'Math angle', 'Music note']), correctIndex: 0 }),
  Object.freeze({ question: 'Which file type is usually an image?', answers: Object.freeze(['.jpg', '.txt', '.mp3']), correctIndex: 0 }),
  Object.freeze({ question: 'What does undo usually do?', answers: Object.freeze(['Reverse last action', 'Save a file', 'Open a menu']), correctIndex: 0 }),
  Object.freeze({ question: 'Which color do blue and yellow make?', answers: Object.freeze(['Green', 'Orange', 'Purple']), correctIndex: 0 }),
  Object.freeze({ question: 'How many beats are in a whole note?', answers: Object.freeze(['2', '4', '8']), correctIndex: 1 }),
  Object.freeze({ question: 'Which instrument has keys?', answers: Object.freeze(['Piano', 'Drum', 'Triangle']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the top number of a fraction called?', answers: Object.freeze(['Numerator', 'Denominator', 'Remainder']), correctIndex: 0 }),
  Object.freeze({ question: 'What is a polygon with eight sides?', answers: Object.freeze(['Octagon', 'Hexagon', 'Decagon']), correctIndex: 0 }),
  Object.freeze({ question: 'Which unit measures length?', answers: Object.freeze(['Meter', 'Liter', 'Gram']), correctIndex: 0 }),
  Object.freeze({ question: 'Which unit measures liquid volume?', answers: Object.freeze(['Liter', 'Meter', 'Watt']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the product of 6 and 7?', answers: Object.freeze(['36', '42', '48']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the quotient of 56 and 8?', answers: Object.freeze(['6', '7', '8']), correctIndex: 1 }),
  Object.freeze({ question: 'Which number is divisible by 3?', answers: Object.freeze(['22', '24', '25']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 10 percent of 90?', answers: Object.freeze(['9', '10', '19']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 4.2 rounded to the nearest whole number?', answers: Object.freeze(['3', '4', '5']), correctIndex: 1 })
]);

const NOTE_SEQUENCES = Object.freeze([
  Object.freeze(['W', 'A', 'S', 'D']),
  Object.freeze(['A', 'D', 'A', 'W']),
  Object.freeze(['D', 'S', 'A', 'W']),
  Object.freeze(['W', 'W', 'A', 'D']),
  Object.freeze(['S', 'A', 'D', 'W'])
]);

const BACKPACK_ITEMS = Object.freeze([
  Object.freeze({ id: 'math-book', label: 'Math Book', category: 'Book' }),
  Object.freeze({ id: 'history-notes', label: 'Notes', category: 'Book' }),
  Object.freeze({ id: 'apple', label: 'Apple', category: 'Snack' }),
  Object.freeze({ id: 'chips', label: 'Chips', category: 'Snack' }),
  Object.freeze({ id: 'slingshot', label: 'Slingshot', category: 'Contraband' }),
  Object.freeze({ id: 'spray-can', label: 'Spray Can', category: 'Contraband' }),
  Object.freeze({ id: 'pencil', label: 'Pencil', category: 'Supply' }),
  Object.freeze({ id: 'eraser', label: 'Eraser', category: 'Supply' })
]);

const BACKPACK_BINS = Object.freeze(['Book', 'Snack', 'Supply', 'Contraband']);

const SCANTRON_KEYS = Object.freeze([
  Object.freeze(['B', 'A', 'D', 'C']),
  Object.freeze(['C', 'D', 'A', 'B']),
  Object.freeze(['A', 'C', 'B', 'D']),
  Object.freeze(['D', 'B', 'C', 'A'])
]);

const MEMORY_MATCH_PAIRS = Object.freeze([
  Object.freeze({ pairId: 'math', icon: 'PI', label: 'Math', accent: '#38d3ff' }),
  Object.freeze({ pairId: 'science', icon: 'H2O', label: 'Science', accent: '#58e2a5' }),
  Object.freeze({ pairId: 'english', icon: 'AB', label: 'English', accent: '#ffd84f' }),
  Object.freeze({ pairId: 'geo', icon: 'MAP', label: 'Geography', accent: '#69a7ff' }),
  Object.freeze({ pairId: 'bio', icon: 'DNA', label: 'Biology', accent: '#ff8fb3' }),
  Object.freeze({ pairId: 'music', icon: 'MUS', label: 'Music', accent: '#b983ff' }),
  Object.freeze({ pairId: 'art', icon: 'ART', label: 'Art', accent: '#ff9f5f' }),
  Object.freeze({ pairId: 'tech', icon: 'CODE', label: 'Tech', accent: '#8ef7e1' })
]);

const SCHOOL_MICROGAME_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.popQuizPanic,
    title: 'Pop Quiz Panic',
    shortTitle: 'Quiz',
    subtitle: 'Answer all three questions before the bell bites.',
    description: 'Get three questions in a row correct before the clock eats the grade.',
    eyebrow: 'Classroom',
    prompt: 'Start pop quiz',
    overheadText: 'E to take pop quiz',
    durationMs: 18000,
    rewardXp: 12,
    rewardMoney: 0,
    accent: '#38d3ff',
    accent2: '#ffd84f',
    secondaryAccent: '#ffd84f',
    icon: '?',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.geographyGlobe,
    title: 'Geography Globe',
    shortTitle: 'Geography',
    subtitle: 'Identify the pinned country on the rotating globe.',
    description: 'Study the needle tip on the country-line globe and choose the matching country before the bell.',
    eyebrow: 'Geography Class',
    prompt: 'Choose the pinned country',
    overheadText: 'E for geography globe',
    durationMs: 24000,
    rewardXp: 15,
    rewardMoney: 0,
    accent: '#5bd7ff',
    accent2: '#ffcf56',
    secondaryAccent: '#ffcf56',
    icon: 'GEO',
    skill: 'intelligence',
    instructions: 'Choose the country at the needle tip.'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.teacherIsLooking,
    title: 'Teacher Is Looking',
    shortTitle: 'Teacher',
    subtitle: 'Green light: type. Red light: freeze.',
    description: 'Type the sentence while the teacher faces the board. Stop when they turn around.',
    eyebrow: 'Risky Notes',
    prompt: 'Type secret sentence',
    overheadText: 'E for risky writing',
    durationMs: 16000,
    rewardXp: 13,
    rewardMoney: 0,
    accent: '#ff7a66',
    accent2: '#78f0b5',
    secondaryAccent: '#78f0b5',
    icon: 'EYE',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.memoryMatch,
    title: 'Memory Card Flip',
    shortTitle: 'Memory',
    subtitle: 'Flip cards and clear every matching pair.',
    description: 'Flip two cards at a time, remember the icons, and match the whole grid.',
    eyebrow: 'Brain Training',
    prompt: 'Start memory card flip',
    overheadText: 'E for memory cards',
    durationMs: 45000,
    rewardXp: 16,
    rewardMoney: 0,
    accent: '#78f0b5',
    accent2: '#ffcf56',
    secondaryAccent: '#ffcf56',
    icon: 'MEM',
    skill: 'intelligence'
  })
]);

const SCHOOL_MICROGAME_BY_ID = new Map(SCHOOL_MICROGAME_DEFINITIONS.map((game) => [game.id, game]));
const SCHOOL_MICROGAME_ALIAS_BY_ID = new Map();

for (const game of SCHOOL_MICROGAME_DEFINITIONS) {
  const aliases = [
    game.id,
    game.title,
    game.shortTitle,
    game.id.replaceAll('-', ''),
    game.id.replaceAll('-', '_'),
    game.title.replaceAll(' ', ''),
    game.title.replaceAll(' ', '-'),
    game.title.replaceAll(' ', '_')
  ];
  for (const alias of aliases) {
    SCHOOL_MICROGAME_ALIAS_BY_ID.set(String(alias).trim().toLowerCase(), game.id);
  }
}

SCHOOL_MICROGAME_ALIAS_BY_ID.set('pop-quiz', SCHOOL_MICROGAME_IDS.popQuizPanic);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('geo', SCHOOL_MICROGAME_IDS.geographyGlobe);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('geography', SCHOOL_MICROGAME_IDS.geographyGlobe);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('geography-class', SCHOOL_MICROGAME_IDS.geographyGlobe);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('globe', SCHOOL_MICROGAME_IDS.geographyGlobe);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('country-globe', SCHOOL_MICROGAME_IDS.geographyGlobe);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('teacher-looking', SCHOOL_MICROGAME_IDS.teacherIsLooking);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('memory', SCHOOL_MICROGAME_IDS.memoryMatch);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('memory-card-flip', SCHOOL_MICROGAME_IDS.memoryMatch);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('memory-card-game', SCHOOL_MICROGAME_IDS.memoryMatch);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('memory-game', SCHOOL_MICROGAME_IDS.memoryMatch);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('memory-cards', SCHOOL_MICROGAME_IDS.memoryMatch);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school', SCHOOL_MICROGAME_DEFAULT_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school-microgame', SCHOOL_MICROGAME_DEFAULT_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school-microgames', SCHOOL_MICROGAME_ALL_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('random-school', SCHOOL_MICROGAME_ALL_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set(SCHOOL_MICROGAME_ALL_ID, SCHOOL_MICROGAME_ALL_ID);

function choose(list, rng) {
  if (!Array.isArray(list) || list.length <= 0) {
    return null;
  }

  return list[Math.floor(rng() * list.length) % list.length];
}

function shuffle(list, rng) {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatQuizQuestion(question) {
  return {
    question: question.question,
    answers: question.answers.map((label, index) => ({ label, index })),
    correctIndex: question.correctIndex
  };
}

export function createSchoolPopQuizQuestions({ rng = Math.random, count = SCHOOL_POP_QUIZ_ROUND_COUNT } = {}) {
  const questionCount = Math.max(1, Math.min(QUESTION_BANK.length, Math.trunc(Number(count) || SCHOOL_POP_QUIZ_ROUND_COUNT)));
  return shuffle(QUESTION_BANK, rng).slice(0, questionCount).map(formatQuizQuestion);
}

function createCombo(rng) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  return digits.slice(0, 3 + Math.floor(rng() * 2));
}

function createBackpackRound(rng) {
  return shuffle(BACKPACK_ITEMS, rng).slice(0, 6).map((item, index) => ({
    ...item,
    id: `${item.id}-${index}`
  }));
}

export function createSchoolMemoryMatchCards({ rng = Math.random } = {}) {
  return shuffle(
    MEMORY_MATCH_PAIRS.flatMap((pair) => [0, 1].map((copyIndex) => ({
      ...pair,
      id: `${pair.pairId}-${copyIndex}`
    }))),
    rng
  ).map((card, index) => ({
    ...card,
    slot: index
  }));
}

export function listSchoolMicrogames() {
  return SCHOOL_MICROGAME_DEFINITIONS;
}

export function listSchoolMicrogameDefinitions() {
  return SCHOOL_MICROGAME_DEFINITIONS;
}

export function normalizeSchoolMicrogameId(value = '', fallback = SCHOOL_MICROGAME_DEFAULT_ID) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  const squashed = normalized.replaceAll('_', '-').replace(/\s+/g, '-');
  return SCHOOL_MICROGAME_ALIAS_BY_ID.get(normalized)
    ?? SCHOOL_MICROGAME_ALIAS_BY_ID.get(squashed)
    ?? fallback;
}

export function getSchoolMicrogameDefinition(value = '') {
  const id = normalizeSchoolMicrogameId(value, '');
  return SCHOOL_MICROGAME_BY_ID.get(id) ?? null;
}

export function getRandomSchoolMicrogameId(rng = Math.random) {
  return choose(SCHOOL_MICROGAME_DEFINITIONS, rng)?.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
}

export function normalizeSchoolMicrogameEnabled(value) {
  return value === true;
}

export function isSchoolMicrogameNpc(npc = null) {
  return npc?.schoolMicrogameEnabled === true;
}

export function getSchoolMicrogamePromptRadius(npc = null, fallbackRadius = 4.8) {
  const radius = Number(npc?.interactRadius ?? fallbackRadius);
  return Math.max(1.5, Number.isFinite(radius) ? radius : fallbackRadius);
}

export function normalizeSchoolMicrogameNpcId(value = '') {
  const normalized = normalizeSchoolMicrogameId(value, SCHOOL_MICROGAME_ALL_ID);
  return normalized === SCHOOL_MICROGAME_ALL_ID ? SCHOOL_MICROGAME_ALL_ID : normalized;
}

export function getSchoolMicrogameReward(value = '') {
  const game = getSchoolMicrogameDefinition(value);
  if (!game) {
    return {
      money: 0,
      xp: 0,
      skill: 'intelligence'
    };
  }

  return {
    money: 0,
    xp: Math.max(0, Math.trunc(Number(game?.rewardXp ?? SCHOOL_MICROGAME_DEFAULT_REWARD_XP) || 0)),
    skill: 'intelligence'
  };
}

export function buildSchoolMicrogameRound(gameId = '', { rng = Math.random, now = Date.now() } = {}) {
  const definition = getSchoolMicrogameDefinition(gameId) ?? SCHOOL_MICROGAME_DEFINITIONS[0];
  const base = {
    id: `school_${definition.id}_${Math.max(0, Math.floor(now))}_${Math.floor(rng() * 100000)}`,
    gameId: definition.id,
    title: definition.title,
    shortTitle: definition.shortTitle,
    eyebrow: definition.eyebrow,
    description: definition.description,
    durationMs: definition.durationMs,
    rewardXp: definition.rewardXp,
    rewardMoney: definition.rewardMoney,
    accent: definition.accent,
    accent2: definition.accent2,
    secondaryAccent: definition.secondaryAccent,
    icon: definition.icon
  };

  if (definition.id === SCHOOL_MICROGAME_IDS.popQuizPanic) {
    const questions = createSchoolPopQuizQuestions({ rng });
    const question = questions[0];
    return {
      ...base,
      questionCount: questions.length,
      questions,
      question: question.question,
      answers: question.answers,
      correctIndex: question.correctIndex
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.geographyGlobe) {
    const country = createSchoolGeographyCountry({ rng });
    const choices = createSchoolGeographyCountryChoices({ country, rng, count: 4 });
    return {
      ...base,
      country,
      choices,
      correctChoiceIndex: choices.findIndex((choice) => String(choice.id) === String(country.id))
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.lockerCombo) {
    return {
      ...base,
      combo: createCombo(rng),
      previewMs: 1450,
      keypad: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.copyTheNotes) {
    return {
      ...base,
      sequence: [...choose(NOTE_SEQUENCES, rng)],
      keys: ['W', 'A', 'S', 'D']
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.teacherIsLooking) {
    return {
      ...base,
      targetProgress: 100,
      lookCycleMs: 2600,
      lookWindowMs: 1050,
      startingPhaseMs: Math.floor(rng() * 700)
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.memoryMatch) {
    const cards = createSchoolMemoryMatchCards({ rng });
    return {
      ...base,
      cards,
      gridSize: 4,
      pairCount: cards.length / 2
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.dodgeTheChalk) {
    return {
      ...base,
      lanes: ['Left', 'Center', 'Right'],
      lives: 2,
      spawnEveryMs: 780
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.sortTheBackpack) {
    return {
      ...base,
      items: createBackpackRound(rng),
      bins: [...BACKPACK_BINS],
      targetCorrect: 5,
      maxWrong: 2
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.bellSprint) {
    const targetStart = 0.58 + (rng() * 0.12);
    return {
      ...base,
      targetStart,
      targetEnd: Math.min(0.88, targetStart + 0.17),
      markerSpeed: 1.56 + (rng() * 0.2)
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.scantronSpeedrun) {
    return {
      ...base,
      answerKey: [...choose(SCANTRON_KEYS, rng)],
      options: ['A', 'B', 'C', 'D'],
      maxWrong: 1
    };
  }

  return base;
}
