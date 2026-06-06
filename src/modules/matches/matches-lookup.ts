
export const EDUCATION_TIER: Record<string, number> = {
  'phd': 5, 'doctorate': 5,
  'master': 4, 'mba': 4, 'postgraduate': 4, 'pg': 4,
  'bachelor': 3, 'undergraduate': 3, 'be': 3, 'btech': 3, 'bsc': 3,
  'diploma': 2, 'polytechnic': 2,
  'high school': 1, 'sslc': 1, 'hsc': 1,
};

export const METRO_CITIES = new Set([
  'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad',
  'chennai', 'kolkata', 'pune', 'ahmedabad', 'surat',
]);

export const FAMILY_TYPE_COMPATIBILITY: Record<string, Record<string, number>> = {
  'nuclear':  { 'nuclear': 95, 'joint': 55, 'extended': 50 },
  'joint':    { 'joint': 95, 'nuclear': 55, 'extended': 80 },
  'extended': { 'extended': 95, 'joint': 80, 'nuclear': 50 },
};

export const FAMILY_VALUES_COMPATIBILITY: Record<string, Record<string, number>> = {
  'traditional': { 'traditional': 95, 'moderate': 65, 'liberal': 40 },
  'moderate':    { 'moderate': 95, 'traditional': 65, 'liberal': 65 },
  'liberal':     { 'liberal': 95, 'moderate': 65, 'traditional': 40 },
};

// Fields that pair well professionally/intellectually
export const FIELD_AFFINITY: Record<string, string[]> = {
  'marketing':   ['business', 'management', 'mba', 'communications', 'hr'],
  'engineering': ['technology', 'computer science', 'it', 'science'],
  'finance':     ['accounting', 'economics', 'commerce', 'banking', 'mba'],
  'medicine':    ['pharmacy', 'nursing', 'life sciences', 'biology'],
  'law':         ['political science', 'public administration'],
  'arts':        ['design', 'media', 'journalism', 'literature'],
};

export const INSTITUTION_TIER: Record<string, number> = {
  // Tier 1 — Premier
  'iim': 5, 'iit': 5, 'aiims': 5, 'nit': 4,
  'bits': 4, 'srm': 3, 'vit': 3,
  'symbiosis': 3, 'manipal': 3, 'christ': 3,
  // Tier 4 — default for unknown
};

export const OCCUPATION_CATEGORY: Record<string, string> = {
  'software engineer': 'tech',     'developer': 'tech',
  'data scientist': 'tech',        'product manager': 'tech',
  'marketing manager': 'business', 'sales manager': 'business',
  'business analyst': 'business',  'consultant': 'business',
  'financial analyst': 'finance',  'chartered accountant': 'finance',
  'banker': 'finance',             'investment banker': 'finance',
  'doctor': 'medical',             'physician': 'medical',
  'dentist': 'medical',            'pharmacist': 'medical',
  'teacher': 'education',          'professor': 'education',
  'lawyer': 'legal',               'advocate': 'legal',
  'entrepreneur': 'business',      'self employed': 'business',
  'government': 'government',      'civil servant': 'government',
};

// Compatible occupation category pairs
export const OCCUPATION_COMPATIBILITY: Record<string, string[]> = {
  'tech':       ['tech', 'business', 'finance'],
  'business':   ['business', 'tech', 'finance', 'government'],
  'finance':    ['finance', 'business', 'tech'],
  'medical':    ['medical', 'education'],
  'education':  ['education', 'medical', 'government'],
  'legal':      ['legal', 'business', 'government'],
  'government': ['government', 'business', 'education'],
};

export const COMPANY_TIER: Record<string, number> = {
  // MNC / Big 4 / FAANG-equivalent
  'accenture': 4, 'tcs': 4, 'infosys': 4, 'wipro': 4,
  'google': 5, 'microsoft': 5, 'amazon': 5, 'meta': 5, 'apple': 5,
  'deloitte': 5, 'pwc': 5, 'kpmg': 5, 'ey': 5,
  'mckinsey': 5, 'bcg': 5, 'bain': 5,
};