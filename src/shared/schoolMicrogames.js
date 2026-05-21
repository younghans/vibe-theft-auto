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
  sketchGuessr: 'sketch-guessr',
  sketch: 'sketch-guessr',
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
export const SCHOOL_SKETCH_GUESSR_GUESS_DURATION_MS = 14000;
export const SCHOOL_SKETCH_GUESSR_DRAW_DURATION_MS = 19000;
export const SCHOOL_SKETCH_GUESSR_REVEAL_MS = 1250;

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

const FALLBACK_GEOGRAPHY_COUNTRIES = Object.freeze([
  Object.freeze({ id: 'usa', name: 'United States', lat: 39.8, lon: -98.6, aliases: Object.freeze(['United States of America', 'USA']) }),
  Object.freeze({ id: 'bra', name: 'Brazil', lat: -10.8, lon: -53.1, aliases: Object.freeze(['Federative Republic of Brazil']) }),
  Object.freeze({ id: 'jpn', name: 'Japan', lat: 37.5, lon: 138.3, aliases: Object.freeze(['Nippon']) }),
  Object.freeze({ id: 'zaf', name: 'South Africa', lat: -29, lon: 24, aliases: Object.freeze(['Republic of South Africa']) })
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

function freezeSketch(sketch) {
  return Object.freeze({
    id: sketch.id,
    label: sketch.label,
    aliases: Object.freeze(cloneArray(sketch.aliases)),
    viewBox: sketch.viewBox ?? '0 0 100 100',
    strokes: Object.freeze(sketch.strokes.map((stroke) => Object.freeze({
      d: stroke.d,
      width: stroke.width ?? 4
    })))
  });
}

const SCHOOL_SKETCH_GUESSR_SKETCHES = Object.freeze([
  freezeSketch({
    id: 'cat',
    label: 'Cat',
    aliases: ['kitty', 'kitten'],
    strokes: [
      { d: 'M30 52 C28 36 38 25 50 25 C62 25 72 36 70 52 C68 66 58 74 50 74 C42 74 32 66 30 52' },
      { d: 'M35 34 L31 18 L43 28 M65 34 L69 18 L57 28' },
      { d: 'M41 48 L45 48 M55 48 L59 48', width: 5 },
      { d: 'M50 54 L47 58 M50 54 L53 58 M47 58 C49 61 51 61 53 58' },
      { d: 'M24 52 L40 54 M24 60 L40 58 M60 54 L76 52 M60 58 L76 60' }
    ]
  }),
  freezeSketch({
    id: 'dog',
    label: 'Dog',
    aliases: ['puppy'],
    strokes: [
      { d: 'M30 50 C30 35 39 27 51 27 C64 27 72 36 72 50 C72 64 62 73 50 73 C38 73 30 64 30 50' },
      { d: 'M33 37 C24 37 20 45 23 58 C29 56 32 49 33 37 M67 37 C76 37 80 45 77 58 C71 56 68 49 67 37' },
      { d: 'M40 47 L44 47 M57 47 L61 47', width: 5 },
      { d: 'M45 55 C46 51 54 51 55 55 C55 61 45 61 45 55' },
      { d: 'M50 59 C49 64 52 67 56 64 M50 59 C49 64 46 67 42 64' }
    ]
  }),
  freezeSketch({
    id: 'apple',
    label: 'Apple',
    aliases: ['fruit'],
    strokes: [
      { d: 'M50 31 C42 24 28 31 27 48 C26 66 39 80 50 74 C61 80 74 66 73 48 C72 31 58 24 50 31' },
      { d: 'M50 31 C51 24 54 18 60 15' },
      { d: 'M58 20 C66 17 72 20 76 27 C67 29 61 27 58 20' },
      { d: 'M38 43 C35 51 37 61 44 67' },
      { d: 'M58 32 C62 30 67 32 70 36' }
    ]
  }),
  freezeSketch({
    id: 'banana',
    label: 'Banana',
    aliases: ['plantain'],
    strokes: [
      { d: 'M21 45 C40 75 70 77 86 46 C69 60 44 58 28 36' },
      { d: 'M28 36 C43 47 66 48 86 46' },
      { d: 'M20 43 C17 40 17 36 22 34 L28 36' },
      { d: 'M86 46 C91 45 93 49 90 53 C87 53 85 51 84 49' },
      { d: 'M39 55 C50 62 65 61 77 53' }
    ]
  }),
  freezeSketch({
    id: 'car',
    label: 'Car',
    aliases: ['auto', 'vehicle'],
    strokes: [
      { d: 'M17 61 L23 45 C26 38 33 35 42 35 L58 35 C67 35 74 39 78 47 L84 61 Z' },
      { d: 'M35 36 L29 50 L70 50 L61 36' },
      { d: 'M25 61 C25 54 36 54 36 61 C36 68 25 68 25 61 M64 61 C64 54 75 54 75 61 C75 68 64 68 64 61' },
      { d: 'M18 61 L84 61' },
      { d: 'M43 36 L43 50 M58 36 L58 50' }
    ]
  }),
  freezeSketch({
    id: 'house',
    label: 'House',
    aliases: ['home'],
    strokes: [
      { d: 'M20 48 L50 22 L80 48' },
      { d: 'M27 46 L27 78 L73 78 L73 46' },
      { d: 'M43 78 L43 58 L57 58 L57 78' },
      { d: 'M33 54 L43 54 L43 64 L33 64 Z M58 54 L68 54 L68 64 L58 64 Z' },
      { d: 'M62 30 L62 21 L70 21 L70 37' }
    ]
  }),
  freezeSketch({
    id: 'tree',
    label: 'Tree',
    aliases: ['oak'],
    strokes: [
      { d: 'M45 80 L45 55 M55 80 L55 55 M43 80 L57 80' },
      { d: 'M50 57 C35 60 23 50 28 38 C19 31 28 17 42 23 C47 10 64 12 67 26 C80 26 84 43 72 51 C68 61 57 63 50 57' },
      { d: 'M50 55 L39 42 M50 55 L61 41' },
      { d: 'M36 32 C43 27 51 28 56 34' },
      { d: 'M58 25 C64 31 64 39 59 46' }
    ]
  }),
  freezeSketch({
    id: 'fish',
    label: 'Fish',
    aliases: ['goldfish'],
    strokes: [
      { d: 'M22 51 C36 32 63 32 77 51 C63 70 36 70 22 51' },
      { d: 'M77 51 L91 39 L91 63 Z' },
      { d: 'M37 51 C42 45 42 57 37 51' },
      { d: 'M55 39 L48 30 M55 63 L48 72' },
      { d: 'M28 51 C31 48 31 54 28 51' }
    ]
  }),
  freezeSketch({
    id: 'star',
    label: 'Star',
    aliases: ['stars'],
    strokes: [
      { d: 'M50 14 L60 39 L87 39 L65 55 L74 82 L50 66 L26 82 L35 55 L13 39 L40 39 Z' },
      { d: 'M50 14 L50 66' },
      { d: 'M13 39 L65 55' },
      { d: 'M87 39 L35 55' },
      { d: 'M26 82 L60 39 M74 82 L40 39' }
    ]
  }),
  freezeSketch({
    id: 'flower',
    label: 'Flower',
    aliases: ['daisy'],
    strokes: [
      { d: 'M50 46 C42 36 47 26 50 26 C53 26 58 36 50 46' },
      { d: 'M50 46 C60 38 70 43 70 46 C70 49 60 54 50 46' },
      { d: 'M50 46 C58 56 53 66 50 66 C47 66 42 56 50 46' },
      { d: 'M50 46 C40 54 30 49 30 46 C30 43 40 38 50 46' },
      { d: 'M44 46 C44 38 56 38 56 46 C56 54 44 54 44 46 M50 54 L50 84 M50 68 C41 65 35 68 31 75 M50 69 C60 64 67 67 71 74' }
    ]
  }),
  freezeSketch({
    id: 'cup',
    label: 'Cup',
    aliases: ['mug', 'coffee'],
    strokes: [
      { d: 'M28 38 L33 77 C34 83 66 83 67 77 L72 38 Z' },
      { d: 'M72 46 C88 44 88 66 70 64' },
      { d: 'M35 38 C42 42 58 42 65 38' },
      { d: 'M40 27 C36 22 45 19 41 14 M51 27 C47 22 56 19 52 14 M62 27 C58 22 67 19 63 14' },
      { d: 'M35 78 C43 82 57 82 65 78' }
    ]
  }),
  freezeSketch({
    id: 'book',
    label: 'Book',
    aliases: ['notebook'],
    strokes: [
      { d: 'M18 25 C31 19 42 22 50 29 C58 22 69 19 82 25 L82 76 C69 70 58 72 50 80 C42 72 31 70 18 76 Z' },
      { d: 'M50 29 L50 80' },
      { d: 'M25 35 C34 32 42 34 47 39 M25 46 C35 43 42 45 47 50 M25 57 C35 54 42 56 47 61' },
      { d: 'M55 39 C61 34 69 32 77 35 M55 50 C61 45 69 43 77 46 M55 61 C61 56 69 54 77 57' },
      { d: 'M18 25 L18 76 M82 25 L82 76' }
    ]
  }),
  freezeSketch({
    id: 'chair',
    label: 'Chair',
    aliases: ['seat'],
    strokes: [
      { d: 'M34 20 L66 20 L66 49 L34 49 Z' },
      { d: 'M27 51 L73 51 L69 62 L31 62 Z' },
      { d: 'M34 62 L30 82 M66 62 L70 82' },
      { d: 'M38 49 L38 62 M62 49 L62 62' },
      { d: 'M39 31 L61 31 M39 40 L61 40' }
    ]
  }),
  freezeSketch({
    id: 'umbrella',
    label: 'Umbrella',
    aliases: ['parasol'],
    strokes: [
      { d: 'M16 53 C25 25 75 25 84 53 Z' },
      { d: 'M16 53 C24 46 33 46 41 53 C47 46 53 46 59 53 C67 46 76 46 84 53' },
      { d: 'M50 53 L50 78' },
      { d: 'M50 78 C50 88 35 88 36 78' },
      { d: 'M50 31 L41 53 M50 31 L59 53 M50 31 L25 53 M50 31 L75 53' }
    ]
  }),
  freezeSketch({
    id: 'guitar',
    label: 'Guitar',
    aliases: ['instrument'],
    strokes: [
      { d: 'M38 63 C26 67 20 55 28 47 C20 35 34 27 43 38 C49 32 59 35 60 45 C72 46 75 61 63 66 C61 78 44 78 38 63' },
      { d: 'M56 39 L79 16' },
      { d: 'M74 13 L87 26 M78 10 L90 22' },
      { d: 'M42 50 C42 43 53 43 53 50 C53 57 42 57 42 50' },
      { d: 'M50 44 L82 18 M53 48 L85 22 M47 41 L79 15' }
    ]
  }),
  freezeSketch({
    id: 'pizza',
    label: 'Pizza',
    aliases: ['slice'],
    strokes: [
      { d: 'M25 24 C43 16 61 16 78 24 L50 86 Z' },
      { d: 'M25 24 C41 34 61 34 78 24' },
      { d: 'M44 42 C44 37 52 37 52 42 C52 47 44 47 44 42 M57 58 C57 53 65 53 65 58 C65 63 57 63 57 58 M40 65 C40 61 47 61 47 65 C47 69 40 69 40 65' },
      { d: 'M50 86 L53 70 M50 86 L44 70' },
      { d: 'M34 31 C42 35 57 35 69 30' }
    ]
  }),
  freezeSketch({
    id: 'clock',
    label: 'Clock',
    aliases: ['watch'],
    strokes: [
      { d: 'M50 15 C31 15 16 31 16 50 C16 69 31 85 50 85 C69 85 84 69 84 50 C84 31 69 15 50 15' },
      { d: 'M50 50 L50 29 M50 50 L64 59' },
      { d: 'M50 20 L50 26 M50 74 L50 80 M20 50 L26 50 M74 50 L80 50' },
      { d: 'M31 31 L35 35 M69 31 L65 35 M31 69 L35 65 M69 69 L65 65' },
      { d: 'M47 50 C47 46 53 46 53 50 C53 54 47 54 47 50' }
    ]
  }),
  freezeSketch({
    id: 'key',
    label: 'Key',
    aliases: ['keys'],
    strokes: [
      { d: 'M24 50 C24 39 41 39 41 50 C41 61 24 61 24 50' },
      { d: 'M41 50 L83 50' },
      { d: 'M67 50 L67 62 L75 62 L75 55 L83 55' },
      { d: 'M29 50 C29 46 36 46 36 50 C36 54 29 54 29 50' },
      { d: 'M43 46 L43 54' }
    ]
  }),
  freezeSketch({
    id: 'shoe',
    label: 'Shoe',
    aliases: ['sneaker', 'shoes'],
    strokes: [
      { d: 'M18 64 C27 62 35 56 41 45 C44 39 50 41 56 48 C63 56 71 60 83 61 C90 62 94 68 91 74 C88 79 79 80 68 79 L28 79 C18 79 12 73 18 64' },
      { d: 'M19 72 C30 75 45 75 59 74 C72 74 84 73 91 72 M24 80 L83 80 C88 80 91 77 91 73' },
      { d: 'M42 45 C48 51 56 52 65 50 M42 45 L34 63 C41 65 52 65 64 62' },
      { d: 'M55 48 L52 61 M60 52 L57 63 M65 56 L62 64' },
      { d: 'M48 52 L61 53 M45 58 L66 59 M39 63 L70 64' },
      { d: 'M25 64 C30 60 35 57 41 45' },
      { d: 'M74 61 C81 62 87 65 90 70' },
      { d: 'M31 74 L31 80 M43 75 L43 80 M55 75 L55 80 M67 74 L67 80 M79 74 L79 80', width: 3 }
    ]
  }),
  freezeSketch({
    id: 'boat',
    label: 'Boat',
    aliases: ['sailboat', 'ship'],
    strokes: [
      { d: 'M25 64 L79 64 L68 78 L36 78 Z' },
      { d: 'M48 63 L48 23' },
      { d: 'M50 27 L76 58 L50 58 Z' },
      { d: 'M46 32 L25 58 L46 58 Z' },
      { d: 'M19 83 C27 78 35 88 43 83 C51 78 59 88 67 83 C75 78 83 88 91 83' }
    ]
  }),
  freezeSketch({
    id: 'hat',
    label: 'Hat',
    aliases: ['cap', 'baseball cap'],
    strokes: [
      { d: 'M20 60 C22 41 36 28 53 28 C69 29 80 43 78 60 C65 66 38 66 20 60' },
      { d: 'M20 60 C35 67 60 68 78 60 C86 60 94 65 96 72 C86 76 74 74 64 67' },
      { d: 'M31 57 C33 43 42 35 53 34 C63 35 71 44 72 58' },
      { d: 'M32 45 C41 51 59 52 70 45' },
      { d: 'M26 61 C39 56 63 56 76 61' },
      { d: 'M49 29 C47 39 48 50 51 61 M59 31 C57 41 58 51 62 60' },
      { d: 'M53 28 C51 24 57 24 56 28' },
      { d: 'M77 60 C84 63 91 67 96 72' }
    ]
  }),
  freezeSketch({
    id: 'lamp',
    label: 'Lamp',
    aliases: ['desk lamp', 'light'],
    strokes: [
      { d: 'M33 25 L67 25 L74 49 L26 49 Z' },
      { d: 'M38 25 C41 17 59 17 62 25' },
      { d: 'M43 49 L43 58 C43 66 57 66 57 58 L57 49' },
      { d: 'M50 66 L50 82' },
      { d: 'M34 84 C38 78 62 78 66 84 Z' },
      { d: 'M38 34 L62 34 M31 43 L69 43' }
    ]
  }),
  freezeSketch({
    id: 'pencil',
    label: 'Pencil',
    aliases: ['pen'],
    strokes: [
      { d: 'M20 40 L68 40 L88 50 L68 60 L20 60 Z' },
      { d: 'M12 40 L20 40 L20 60 L12 60 Z' },
      { d: 'M20 40 L28 40 L28 60 L20 60' },
      { d: 'M68 40 L78 50 L68 60' },
      { d: 'M78 50 L88 50' },
      { d: 'M31 50 L66 50' },
      { d: 'M22 43 L22 57 M25 43 L25 57' },
      { d: 'M12 42 C8 45 8 55 12 58' },
      { d: 'M39 44 L60 44 M39 56 L60 56', width: 3 }
    ]
  })
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
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.sketchGuessr,
    title: 'Sketch Guessr',
    shortTitle: 'Sketch',
    subtitle: 'Guess the object before the sketch finishes.',
    description: 'Watch the black and white sketch draw itself, then type the object before the last lines appear.',
    eyebrow: 'Art Class',
    prompt: 'Type the object before the drawing finishes',
    overheadText: 'E for sketch guessr',
    durationMs: SCHOOL_SKETCH_GUESSR_GUESS_DURATION_MS,
    rewardXp: 14,
    rewardMoney: 0,
    accent: '#f8fafc',
    accent2: '#38d3ff',
    secondaryAccent: '#38d3ff',
    icon: 'ART',
    skill: 'intelligence',
    instructions: 'Type the object name and press Enter or Guess.'
  })
]);

const SCHOOL_MICROGAME_BY_ID = new Map();
for (let index = 0; index < SCHOOL_MICROGAME_DEFINITIONS.length; index += 1) {
  const game = SCHOOL_MICROGAME_DEFINITIONS[index];
  SCHOOL_MICROGAME_BY_ID.set(game.id, game);
}
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
SCHOOL_MICROGAME_ALIAS_BY_ID.set('art', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('drawing', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('draw', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('pictionary', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('sketch-guess', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('sketch-guesser', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('skribbl', SCHOOL_MICROGAME_IDS.sketchGuessr);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('skribblio', SCHOOL_MICROGAME_IDS.sketchGuessr);
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

function createFallbackSchoolGeographyCountry({ rng = Math.random } = {}) {
  const country = choose(FALLBACK_GEOGRAPHY_COUNTRIES, rng) ?? FALLBACK_GEOGRAPHY_COUNTRIES[0];
  return {
    id: country.id,
    name: country.name,
    lat: country.lat,
    lon: country.lon,
    aliases: cloneArray(country.aliases)
  };
}

function shuffle(list, rng) {
  const next = cloneArray(list);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function cloneArray(list = []) {
  const next = [];
  for (const item of list) {
    next.push(item);
  }
  return next;
}

function formatQuizQuestion(question) {
  const answers = [];
  for (let index = 0; index < question.answers.length; index += 1) {
    answers.push({ label: question.answers[index], index });
  }
  return {
    question: question.question,
    answers,
    correctIndex: question.correctIndex
  };
}

export function createSchoolPopQuizQuestions({ rng = Math.random, count = SCHOOL_POP_QUIZ_ROUND_COUNT } = {}) {
  const questionCount = Math.max(1, Math.min(QUESTION_BANK.length, Math.trunc(Number(count) || SCHOOL_POP_QUIZ_ROUND_COUNT)));
  const shuffled = shuffle(QUESTION_BANK, rng);
  const questions = [];
  for (let index = 0; index < questionCount; index += 1) {
    questions.push(formatQuizQuestion(shuffled[index]));
  }
  return questions;
}

function createCombo(rng) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  return digits.slice(0, 3 + Math.floor(rng() * 2));
}

function createBackpackRound(rng) {
  const shuffled = shuffle(BACKPACK_ITEMS, rng);
  const items = [];
  for (let index = 0; index < 6 && index < shuffled.length; index += 1) {
    const item = shuffled[index];
    items.push({
      ...item,
      id: `${item.id}-${index}`
    });
  }
  return items;
}

export function createSchoolMemoryMatchCards({ rng = Math.random } = {}) {
  const pairs = [];
  for (const pair of MEMORY_MATCH_PAIRS) {
    for (let copyIndex = 0; copyIndex < 2; copyIndex += 1) {
      pairs.push({
        ...pair,
        id: `${pair.pairId}-${copyIndex}`
      });
    }
  }

  const shuffled = shuffle(pairs, rng);
  const cards = [];
  for (let index = 0; index < shuffled.length; index += 1) {
    cards.push({
      ...shuffled[index],
      slot: index
    });
  }
  return cards;
}

function cloneSchoolSketchGuessrSketch(sketch) {
  const strokes = [];
  for (const stroke of Array.isArray(sketch?.strokes) ? sketch.strokes : []) {
    strokes.push({
      d: stroke.d,
      width: stroke.width ?? 4
    });
  }

  return {
    id: sketch?.id ?? '',
    label: sketch?.label ?? '',
    aliases: cloneArray(sketch?.aliases ?? []),
    viewBox: sketch?.viewBox ?? '0 0 100 100',
    strokes
  };
}

export function listSchoolSketchGuessrSketches() {
  return SCHOOL_SKETCH_GUESSR_SKETCHES;
}

export function normalizeSchoolSketchGuess(value = '') {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

export function isSchoolSketchGuessAnswer(sketch = null, guess = '') {
  const normalizedGuess = normalizeSchoolSketchGuess(guess);
  if (!normalizedGuess) {
    return false;
  }

  const candidates = [sketch?.label, ...(Array.isArray(sketch?.aliases) ? sketch.aliases : [])];
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSchoolSketchGuess(candidate);
    if (!normalizedCandidate) {
      continue;
    }
    if (normalizedGuess === normalizedCandidate || normalizedGuess === `${normalizedCandidate}s`) {
      return true;
    }
  }
  return false;
}

export function createSchoolSketchGuessrRound({ rng = Math.random } = {}) {
  const sketch = cloneSchoolSketchGuessrSketch(
    choose(SCHOOL_SKETCH_GUESSR_SKETCHES, rng) ?? SCHOOL_SKETCH_GUESSR_SKETCHES[0]
  );
  return {
    sketch,
    answerLength: normalizeSchoolSketchGuess(sketch.label).length,
    drawDurationMs: SCHOOL_SKETCH_GUESSR_DRAW_DURATION_MS,
    guessDurationMs: SCHOOL_SKETCH_GUESSR_GUESS_DURATION_MS,
    revealMs: SCHOOL_SKETCH_GUESSR_REVEAL_MS
  };
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
      sequence: cloneArray(choose(NOTE_SEQUENCES, rng)),
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

  if (definition.id === SCHOOL_MICROGAME_IDS.sketchGuessr) {
    return {
      ...base,
      ...createSchoolSketchGuessrRound({ rng })
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
      bins: cloneArray(BACKPACK_BINS),
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
      answerKey: cloneArray(choose(SCANTRON_KEYS, rng)),
      options: ['A', 'B', 'C', 'D'],
      maxWrong: 1
    };
  }

  return base;
}
