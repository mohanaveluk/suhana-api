/**
 * Centralised dictionaries backing the local NLP parser.
 *
 * Every entry maps a canonical value to the surface forms members actually type.
 * The canonical value is what reaches the database, so adding a synonym here is
 * all that is needed to teach the parser a new phrasing — no parser change, and
 * critically no LLM call. Extending these tables is the cheapest way to push the
 * AI-fallback rate down.
 */
export interface DictionaryEntry {
  /** The value written into the SearchIntent and matched against the DB. */
  canonical: string;
  /** Surface forms, lower-case. The canonical is matched implicitly. */
  synonyms: string[];
}

// ─── Profession ─────────────────────────────────────────────────────────────
export const PROFESSION_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'Doctor',
    synonyms: [
      'doctor', 'physician', 'surgeon', 'medical doctor', 'md', 'mbbs',
      'medico', 'gp', 'general practitioner', 'consultant physician',
      'cardiologist', 'dentist', 'paediatrician', 'pediatrician',
      'radiologist', 'anesthesiologist', 'anaesthetist', 'gynecologist',
      'orthopedic', 'neurologist', 'oncologist', 'psychiatrist',
    ],
  },
  {
    canonical: 'Software Engineer',
    synonyms: [
      'software engineer', 'software developer', 'developer', 'programmer',
      'coder', 'software professional', 'swe', 'sde', 'full stack developer',
      'fullstack developer', 'frontend developer', 'front end developer',
      'backend developer', 'back end developer', 'web developer',
      'application developer', 'it professional', 'software architect',
      'devops engineer', 'mobile developer', 'android developer',
      'ios developer', 'techie', 'software',
    ],
  },
  {
    canonical: 'Data Scientist',
    synonyms: [
      'data scientist', 'data analyst', 'machine learning engineer',
      'ml engineer', 'ai engineer', 'data engineer', 'analytics professional',
    ],
  },
  {
    canonical: 'Engineer',
    synonyms: [
      'engineer', 'mechanical engineer', 'civil engineer', 'electrical engineer',
      'electronics engineer', 'chemical engineer', 'aerospace engineer',
      'be', 'btech', 'b tech',
    ],
  },
  {
    canonical: 'Teacher',
    synonyms: [
      'teacher', 'educator', 'school teacher', 'tutor', 'instructor',
      'lecturer', 'faculty', 'trainer',
    ],
  },
  {
    canonical: 'Professor',
    synonyms: ['professor', 'assistant professor', 'associate professor', 'academic', 'researcher'],
  },
  {
    canonical: 'Lawyer',
    synonyms: [
      'lawyer', 'advocate', 'attorney', 'legal counsel', 'barrister',
      'solicitor', 'llb', 'legal advisor',
    ],
  },
  {
    canonical: 'Chartered Accountant',
    synonyms: [
      'chartered accountant', 'ca', 'accountant', 'cpa', 'auditor',
      'financial analyst', 'finance professional', 'acca',
    ],
  },
  {
    canonical: 'Business Analyst',
    synonyms: ['business analyst', 'ba', 'product manager', 'program manager', 'project manager'],
  },
  {
    canonical: 'Entrepreneur',
    synonyms: [
      'entrepreneur', 'businessman', 'business owner', 'self employed',
      'startup founder', 'founder', 'business person', 'trader',
    ],
  },
  {
    canonical: 'Nurse',
    synonyms: ['nurse', 'nursing professional', 'rn', 'registered nurse', 'staff nurse'],
  },
  {
    canonical: 'Pharmacist',
    synonyms: ['pharmacist', 'pharmacy professional', 'pharm d', 'pharmd'],
  },
  {
    canonical: 'Architect',
    synonyms: ['architect', 'interior designer', 'urban planner'],
  },
  {
    canonical: 'Government Employee',
    synonyms: [
      'government employee', 'government job', 'govt employee', 'govt job',
      'civil servant', 'ias', 'ips', 'irs', 'public sector', 'psu',
      'bank officer', 'banker',
    ],
  },
  {
    canonical: 'Defence',
    synonyms: ['army', 'navy', 'air force', 'defence', 'defense', 'military', 'soldier', 'officer'],
  },
  {
    canonical: 'Consultant',
    synonyms: ['consultant', 'management consultant', 'advisor', 'strategy consultant'],
  },
  {
    canonical: 'Designer',
    synonyms: ['designer', 'ux designer', 'ui designer', 'graphic designer', 'product designer'],
  },
  {
    canonical: 'Scientist',
    synonyms: ['scientist', 'research scientist', 'chemist', 'biologist', 'physicist'],
  },
  {
    canonical: 'Pilot',
    synonyms: ['pilot', 'commercial pilot', 'airline pilot', 'cabin crew', 'air hostess'],
  },
];

// ─── Education ──────────────────────────────────────────────────────────────
export const EDUCATION_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'Doctorate',
    synonyms: ['phd', 'ph d', 'doctorate', 'doctoral', 'dphil', 'post doctorate', 'postdoc'],
  },
  {
    canonical: 'Masters',
    synonyms: [
      'masters', 'master', 'mtech', 'm tech', 'ms', 'msc', 'm sc', 'mba',
      'mca', 'ma', 'mcom', 'm com', 'postgraduate', 'post graduate', 'pg',
      'masters degree',
    ],
  },
  {
    canonical: 'Bachelors',
    synonyms: [
      'bachelors', 'bachelor', 'btech', 'b tech', 'be', 'bsc', 'b sc', 'ba',
      'bcom', 'b com', 'bca', 'bba', 'graduate', 'undergraduate', 'ug',
      'bachelors degree', 'degree',
    ],
  },
  {
    canonical: 'Professional Degree',
    synonyms: ['mbbs', 'md', 'llb', 'llm', 'ca', 'cs', 'icwa', 'professional degree', 'bds', 'bams'],
  },
  {
    canonical: 'Diploma',
    synonyms: ['diploma', 'polytechnic', 'iti', 'certificate course'],
  },
  {
    canonical: 'High School',
    synonyms: ['high school', 'higher secondary', '12th', 'hsc', 'intermediate', 'schooling'],
  },
];

/** Phrases meaning "well educated" without naming a level. Imply Masters or above. */
export const HIGH_EDUCATION_PHRASES = [
  'highly educated', 'well educated', 'well qualified', 'highly qualified',
  'good education', 'strong academic', 'academically strong', 'educated',
];

// ─── Religion ───────────────────────────────────────────────────────────────
export const RELIGION_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'Hindu', synonyms: ['hindu', 'hinduism', 'hindhu'] },
  { canonical: 'Muslim', synonyms: ['muslim', 'islam', 'islamic', 'muslin'] },
  { canonical: 'Christian', synonyms: ['christian', 'christianity', 'catholic', 'protestant'] },
  { canonical: 'Sikh', synonyms: ['sikh', 'sikhism', 'punjabi sikh'] },
  { canonical: 'Jain', synonyms: ['jain', 'jainism'] },
  { canonical: 'Buddhist', synonyms: ['buddhist', 'buddhism'] },
  { canonical: 'Parsi', synonyms: ['parsi', 'zoroastrian'] },
  { canonical: 'Jewish', synonyms: ['jewish', 'judaism'] },
];

// ─── Language / mother tongue ───────────────────────────────────────────────
export const LANGUAGE_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'Tamil', synonyms: ['tamil', 'tamizh', 'thamizh', 'tamil speaking'] },
  { canonical: 'Telugu', synonyms: ['telugu', 'telegu'] },
  { canonical: 'Kannada', synonyms: ['kannada', 'kanada', 'canarese'] },
  { canonical: 'Malayalam', synonyms: ['malayalam', 'malayali', 'mallu'] },
  { canonical: 'Hindi', synonyms: ['hindi', 'hindustani'] },
  { canonical: 'Marathi', synonyms: ['marathi', 'marathe'] },
  { canonical: 'Gujarati', synonyms: ['gujarati', 'gujrati'] },
  { canonical: 'Bengali', synonyms: ['bengali', 'bangla'] },
  { canonical: 'Punjabi', synonyms: ['punjabi', 'panjabi'] },
  { canonical: 'Urdu', synonyms: ['urdu'] },
  { canonical: 'Odia', synonyms: ['odia', 'oriya'] },
  { canonical: 'Konkani', synonyms: ['konkani'] },
  { canonical: 'Tulu', synonyms: ['tulu'] },
  { canonical: 'English', synonyms: ['english'] },
];

// ─── Personality traits ─────────────────────────────────────────────────────
// Canonical trait values are matched against Profile.partnerExpectations,
// Profile.interests, Profile.personalityType and free text in aboutMe.
export const PERSONALITY_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'caring', synonyms: ['caring', 'loving', 'affectionate', 'warm', 'compassionate', 'nurturing', 'thoughtful'] },
  { canonical: 'kind', synonyms: ['kind', 'kind hearted', 'kindhearted', 'gentle', 'good hearted', 'humble'] },
  { canonical: 'family-oriented', synonyms: ['family oriented', 'family-oriented', 'family focused', 'family person', 'family loving', 'values family', 'family first'] },
  { canonical: 'traditional', synonyms: ['traditional', 'cultured', 'conservative', 'orthodox', 'values culture', 'rooted'] },
  { canonical: 'modern', synonyms: ['modern', 'progressive', 'open minded', 'open-minded', 'contemporary', 'forward thinking'] },
  { canonical: 'honest', synonyms: ['honest', 'truthful', 'sincere', 'genuine', 'trustworthy', 'straightforward'] },
  { canonical: 'friendly', synonyms: ['friendly', 'sociable', 'outgoing', 'cheerful', 'jovial', 'extrovert', 'fun loving'] },
  { canonical: 'spiritual', synonyms: ['spiritual', 'religious', 'god fearing', 'god-fearing', 'devout', 'pious'] },
  { canonical: 'independent', synonyms: ['independent', 'self reliant', 'self-reliant', 'self made', 'confident'] },
  { canonical: 'ambitious', synonyms: ['ambitious', 'driven', 'motivated', 'goal oriented', 'hard working', 'hardworking', 'determined'] },
  { canonical: 'career-focused', synonyms: ['career focused', 'career-focused', 'career oriented', 'career minded', 'professional'] },
  { canonical: 'adventurous', synonyms: ['adventurous', 'travel lover', 'wanderlust', 'explorer', 'outdoorsy'] },
  { canonical: 'creative', synonyms: ['creative', 'artistic', 'musical', 'imaginative'] },
  { canonical: 'calm', synonyms: ['calm', 'patient', 'easy going', 'easygoing', 'introvert', 'soft spoken', 'quiet'] },
  { canonical: 'health-conscious', synonyms: ['fitness', 'health conscious', 'fit', 'sporty', 'athletic', 'gym'] },
  { canonical: 'vegetarian', synonyms: ['vegetarian', 'veg', 'pure veg', 'vegan'] },
  { canonical: 'non-smoker', synonyms: ['non smoker', 'non-smoker', 'does not smoke', 'no smoking', 'teetotaler', 'non drinker'] },
];

// ─── Family structure / values ──────────────────────────────────────────────
export const FAMILY_TYPE_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'joint',
    synonyms: [
      'joint family', 'joint', 'living with parents', 'lives with parents',
      'parents living together', 'stays with parents', 'extended family',
      'large family',
    ],
  },
  {
    canonical: 'nuclear',
    synonyms: ['nuclear family', 'nuclear', 'small family', 'independent family'],
  },
];

export const FAMILY_VALUES_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'traditional',
    synonyms: [
      'traditional values', 'traditional family', 'conservative values',
      'orthodox family', 'cultural values', 'values family more than career',
      'family more than career', 'family over career', 'family first',
    ],
  },
  { canonical: 'moderate', synonyms: ['moderate values', 'balanced values', 'moderate family'] },
  { canonical: 'liberal', synonyms: ['liberal values', 'liberal family', 'progressive family', 'modern family'] },
];

// ─── Marital status ─────────────────────────────────────────────────────────
// Canonical values match MaritalStatus (src/modules/user/enums). Members type
// "single" and "unmarried" far more often than "never married", so all three
// map to the one stored value.
export const MARITAL_STATUS_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'Never Married',
    synonyms: [
      'never married', 'not married', 'unmarried', 'un married', 'single',
      'bachelor', 'spinster', 'first marriage',
    ],
  },
  {
    canonical: 'Awaiting Divorce',
    synonyms: [
      'awaiting divorce', 'separated', 'legally separated', 'divorce in progress',
      'divorce pending', 'filed for divorce',
    ],
  },
  { canonical: 'Divorced', synonyms: ['divorced', 'divorcee', 'divorcée'] },
  { canonical: 'Widowed', synonyms: ['widowed', 'widow', 'widower'] },
  { canonical: 'Annulled', synonyms: ['annulled', 'annulment', 'marriage annulled'] },
];

/**
 * Phrases meaning "open to someone who has been married before".
 * These widen a search rather than pinning it to one status.
 */
export const REMARRIAGE_PHRASES = [
  'second marriage', 'remarriage', 're marriage', 'open to divorcee',
  'divorcee ok', 'second time',
];

// ─── Gender being searched for ──────────────────────────────────────────────
export const GENDER_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'bride', synonyms: ['bride', 'girl', 'woman', 'female', 'lady', 'she', 'her'] },
  { canonical: 'groom', synonyms: ['groom', 'boy', 'man', 'male', 'guy', 'gentleman', 'he', 'him'] },
];

// ─── US states (the platform's primary market) ──────────────────────────────
export const STATE_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'Texas', synonyms: ['texas', 'tx'] },
  { canonical: 'California', synonyms: ['california', 'ca', 'cali'] },
  { canonical: 'New York', synonyms: ['new york', 'ny', 'nyc'] },
  { canonical: 'New Jersey', synonyms: ['new jersey', 'nj'] },
  { canonical: 'Illinois', synonyms: ['illinois', 'il'] },
  { canonical: 'Florida', synonyms: ['florida', 'fl'] },
  { canonical: 'Washington', synonyms: ['washington', 'wa'] },
  { canonical: 'Georgia', synonyms: ['georgia', 'ga'] },
  { canonical: 'Virginia', synonyms: ['virginia', 'va'] },
  { canonical: 'North Carolina', synonyms: ['north carolina', 'nc'] },
  { canonical: 'Pennsylvania', synonyms: ['pennsylvania', 'pa'] },
  { canonical: 'Massachusetts', synonyms: ['massachusetts', 'ma'] },
  { canonical: 'Michigan', synonyms: ['michigan', 'mi'] },
  { canonical: 'Ohio', synonyms: ['ohio', 'oh'] },
  { canonical: 'Arizona', synonyms: ['arizona', 'az'] },
  { canonical: 'Maryland', synonyms: ['maryland', 'md'] },
  { canonical: 'Minnesota', synonyms: ['minnesota', 'mn'] },
  { canonical: 'Colorado', synonyms: ['colorado', 'co'] },
  { canonical: 'Tamil Nadu', synonyms: ['tamil nadu', 'tamilnadu', 'tn'] },
  { canonical: 'Karnataka', synonyms: ['karnataka'] },
  { canonical: 'Kerala', synonyms: ['kerala'] },
  { canonical: 'Maharashtra', synonyms: ['maharashtra'] },
  { canonical: 'Telangana', synonyms: ['telangana'] },
  { canonical: 'Andhra Pradesh', synonyms: ['andhra pradesh', 'andhra', 'ap'] },
];

export const CITY_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'Dallas', synonyms: ['dallas'] },
  { canonical: 'Houston', synonyms: ['houston'] },
  { canonical: 'Austin', synonyms: ['austin'] },
  { canonical: 'San Antonio', synonyms: ['san antonio'] },
  { canonical: 'Helotes', synonyms: ['helotes'] },
  { canonical: 'San Francisco', synonyms: ['san francisco', 'sf', 'bay area'] },
  { canonical: 'Los Angeles', synonyms: ['los angeles', 'la'] },
  { canonical: 'San Jose', synonyms: ['san jose'] },
  { canonical: 'Seattle', synonyms: ['seattle'] },
  { canonical: 'Chicago', synonyms: ['chicago'] },
  { canonical: 'Atlanta', synonyms: ['atlanta'] },
  { canonical: 'Boston', synonyms: ['boston'] },
  { canonical: 'Phoenix', synonyms: ['phoenix'] },
  { canonical: 'Charlotte', synonyms: ['charlotte'] },
  { canonical: 'Chennai', synonyms: ['chennai', 'madras'] },
  { canonical: 'Bangalore', synonyms: ['bangalore', 'bengaluru'] },
  { canonical: 'Hyderabad', synonyms: ['hyderabad'] },
  { canonical: 'Mumbai', synonyms: ['mumbai', 'bombay'] },
  { canonical: 'Delhi', synonyms: ['delhi', 'new delhi'] },
  { canonical: 'Pune', synonyms: ['pune'] },
  { canonical: 'Coimbatore', synonyms: ['coimbatore'] },
];

export const COUNTRY_DICTIONARY: DictionaryEntry[] = [
  { canonical: 'USA', synonyms: ['usa', 'us', 'united states', 'america', 'u s a'] },
  { canonical: 'India', synonyms: ['india', 'bharat'] },
  { canonical: 'Canada', synonyms: ['canada'] },
  { canonical: 'UK', synonyms: ['uk', 'united kingdom', 'england', 'britain'] },
  { canonical: 'Australia', synonyms: ['australia'] },
  { canonical: 'Singapore', synonyms: ['singapore'] },
  { canonical: 'UAE', synonyms: ['uae', 'dubai', 'abu dhabi'] },
];

// ─── Hobbies / interests ────────────────────────────────────────────────────
// Matched against Profile.interests (a comma-joined simple-array), and also
// against lifestyleHabits, partnerExpectations and aboutMe — members record the
// same interest in whichever field the form put in front of them, so matching
// only `interests` misses most of them.
//
// Synonym lists are deliberately generous here: unlike profession, a false
// positive on a hobby costs almost nothing (it is a ranking signal), while a
// miss costs a relevant profile.
export const HOBBY_DICTIONARY: DictionaryEntry[] = [
  {
    canonical: 'travel',
    synonyms: [
      'travel', 'travels', 'travelling', 'traveling', 'traveller', 'traveler',
      'trekking', 'hiking', 'backpacking', 'road trips', 'sightseeing',
      'exploring', 'wanderlust', 'globetrotting', 'tourism', 'vacation',
    ],
  },
  {
    canonical: 'cooking',
    synonyms: [
      'cooking', 'cook', 'baking', 'foodie', 'culinary', 'chef', 'recipes',
      'food', 'gastronomy', 'barbecue', 'grilling', 'home cooking',
    ],
  },
  {
    canonical: 'music',
    synonyms: [
      'music', 'singing', 'sing', 'singer', 'guitar', 'piano', 'violin',
      'veena', 'flute', 'drums', 'carnatic', 'hindustani', 'classical music',
      'instrumental', 'playing music', 'listening to music', 'concerts',
    ],
  },
  {
    canonical: 'dance',
    synonyms: [
      'dance', 'dancing', 'dancer', 'bharatanatyam', 'bharathanatyam',
      'kathak', 'kuchipudi', 'classical dance', 'salsa', 'zumba',
      'western dance', 'folk dance',
    ],
  },
  {
    canonical: 'reading',
    synonyms: [
      'reading', 'read', 'books', 'book', 'literature', 'bookworm', 'novels',
      'poetry', 'writing', 'blogging', 'journaling',
    ],
  },
  {
    canonical: 'sports',
    synonyms: [
      'sports', 'sport', 'cricket', 'football', 'soccer', 'tennis',
      'badminton', 'basketball', 'volleyball', 'hockey', 'chess', 'carrom',
      'table tennis', 'swimming', 'athletics', 'golf',
    ],
  },
  {
    canonical: 'fitness',
    synonyms: [
      'fitness', 'gym', 'yoga', 'running', 'jogging', 'workout', 'working out',
      'cycling', 'weight training', 'pilates', 'meditation', 'exercise',
      'zumba', 'marathon', 'crossfit',
    ],
  },
  {
    canonical: 'movies',
    synonyms: [
      'movies', 'movie', 'films', 'film', 'cinema', 'netflix', 'web series',
      'tv shows', 'series', 'theatre', 'theater', 'documentaries',
    ],
  },
  {
    canonical: 'photography',
    synonyms: [
      'photography', 'photographer', 'photos', 'videography', 'filmmaking',
      'editing', 'content creation',
    ],
  },
  {
    canonical: 'gardening',
    synonyms: ['gardening', 'garden', 'plants', 'horticulture', 'terrace garden', 'nature'],
  },
  {
    canonical: 'art',
    synonyms: [
      'art', 'painting', 'paint', 'drawing', 'sketching', 'craft', 'crafts',
      'handicraft', 'pottery', 'calligraphy', 'design',
    ],
  },
  {
    canonical: 'technology',
    synonyms: [
      'technology', 'tech', 'gadgets', 'coding', 'programming', 'gaming',
      'video games', 'computers', 'ai', 'robotics',
    ],
  },
  {
    canonical: 'volunteering',
    synonyms: [
      'volunteering', 'volunteer', 'social work', 'charity', 'ngo',
      'community service', 'social service', 'giving back',
    ],
  },
  {
    canonical: 'spirituality',
    synonyms: [
      'spirituality', 'temple', 'prayer', 'bhajan', 'devotional', 'pooja',
      'puja', 'meditation', 'philosophy',
    ],
  },
  {
    canonical: 'pets',
    synonyms: ['pets', 'pet', 'dogs', 'cats', 'animal lover', 'animals'],
  },
];

/**
 * Words carrying no filtering signal. Stripped before keyword extraction so
 * residual `keywords` stay meaningful for free-text search.
 */
export const STOP_WORDS = new Set([
  'find', 'show', 'me', 'a', 'an', 'the', 'for', 'with', 'who', 'whom', 'that',
  'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at',
  'to', 'from', 'of', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as',
  'i', 'my', 'mine', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'them', 'their', 'his', 'her', 'looking', 'look', 'search', 'searching',
  'want', 'wants', 'need', 'needs', 'get', 'give', 'please', 'someone',
  'somebody', 'person', 'people', 'profile', 'profiles', 'match', 'matches',
  'suitable', 'good', 'nice', 'best', 'any', 'some', 'all', 'more', 'most',
  'very', 'really', 'quite', 'just', 'only', 'also', 'can', 'could', 'would',
  'should', 'will', 'shall', 'may', 'might', 'must', 'do', 'does', 'did',
  'have', 'has', 'had', 'there', 'here', 'this', 'these', 'those', 'what',
  'which', 'when', 'where', 'why', 'how',
]);
