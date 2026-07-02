import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const POSTHOG_KEY = Deno.env.get("POSTHOG_KEY");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") || "https://eu.i.posthog.com";

function phCaptureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (!POSTHOG_KEY) return;
  try {
    const body = JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      properties: { ...(properties ?? {}), source: "edge_function" },
      timestamp: new Date().toISOString(),
    });
    const promise = fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      (EdgeRuntime as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(promise);
    }
  } catch {
    /* no-op */
  }
}

const COUNTRY_NAMES: Record<string, string[]> = {
  "Nigeria": ["Emeka", "Chisom", "Adebayo", "Funmi", "Tunde", "Ngozi", "Seun", "Amara", "Biodun", "Kemi"],
  "Ghana": ["Kwame", "Abena", "Kofi", "Akosua", "Yaw", "Ama", "Kweku", "Adwoa", "Nana", "Efua"],
  "Kenya": ["Wanjiru", "Kamau", "Akinyi", "Otieno", "Wanjiku", "Mutua", "Zawadi", "Odhiambo", "Njeri", "Kipchoge"],
  "South Africa": ["Thabo", "Zanele", "Sipho", "Nomvula", "Bongani", "Lindiwe", "Lungelo", "Nompumelelo", "Siyanda", "Ayanda"],
  "Ethiopia": ["Biruk", "Tigist", "Yonas", "Selam", "Dawit", "Hana", "Abel", "Meron", "Kidus", "Liya"],
  "Tanzania": ["Juma", "Amina", "Baraka", "Fatuma", "Said", "Zawadi", "Hamisi", "Neema", "Rashidi", "Rehema"],
  "Uganda": ["Kampala", "Naledi", "Ssekandi", "Namukasa", "Mutebi", "Nakato", "Wasswa", "Nambooze", "Kiprotich", "Akello"],
  "Egypt": ["Ahmed", "Fatima", "Mohamed", "Nour", "Omar", "Sara", "Kareem", "Dina", "Youssef", "Rana"],
  "Morocco": ["Youssef", "Fatima", "Hassan", "Nadia", "Karim", "Samira", "Mehdi", "Zineb", "Amine", "Hajar"],
  "India": ["Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Kavya", "Rohan", "Meera", "Aditya", "Ananya"],
  "Pakistan": ["Hassan", "Ayesha", "Usman", "Zainab", "Bilal", "Fatima", "Imran", "Sana", "Hamza", "Nadia"],
  "Bangladesh": ["Rahim", "Nusrat", "Kamal", "Fatema", "Shakib", "Tania", "Hasan", "Mitu", "Rafi", "Riya"],
  "Sri Lanka": ["Nuwan", "Dilini", "Chamara", "Sachini", "Asanka", "Thilini", "Kasun", "Nadeesha", "Pradeep", "Isuri"],
  "China": ["Wei", "Fang", "Ming", "Ling", "Jian", "Xiu", "Hao", "Yan", "Bin", "Mei"],
  "Japan": ["Kenji", "Yuki", "Hiroshi", "Sakura", "Takeshi", "Aoi", "Ryota", "Hana", "Shota", "Nana"],
  "South Korea": ["Jinho", "Jiyeon", "Minjun", "Soyeon", "Seungho", "Yuna", "Hyunwoo", "Jisoo", "Taehyun", "Minji"],
  "Indonesia": ["Budi", "Sari", "Agus", "Dewi", "Eko", "Rina", "Hendra", "Fitri", "Bambang", "Wulan"],
  "Philippines": ["Carlo", "Maria", "Juan", "Ana", "Jose", "Rosa", "Ramon", "Luisa", "Manuel", "Carla"],
  "Vietnam": ["Minh", "Lan", "Hung", "Linh", "Nam", "Thu", "Duc", "Mai", "Tuan", "Hoa"],
  "Thailand": ["Somchai", "Nong", "Chai", "Ning", "Pong", "Pim", "Nit", "Kwan", "Arm", "Aom"],
  "Malaysia": ["Ahmad", "Siti", "Razif", "Nurul", "Hafiz", "Aishah", "Izzat", "Farah", "Azlan", "Nadia"],
  "Brazil": ["Lucas", "Mariana", "Pedro", "Fernanda", "Rafael", "Camila", "Thiago", "Beatriz", "Gustavo", "Juliana"],
  "Mexico": ["Carlos", "Sofia", "Miguel", "Valentina", "Diego", "Isabella", "Alejandro", "Gabriela", "Eduardo", "Daniela"],
  "Colombia": ["Santiago", "Valeria", "Andres", "Natalia", "Julian", "Camila", "Sebastian", "Laura", "Felipe", "Maria"],
  "Argentina": ["Mateo", "Lucia", "Franco", "Martina", "Ezequiel", "Valentina", "Agustin", "Florencia", "Nicolas", "Paula"],
  "Peru": ["Diego", "Gabriela", "Javier", "Lorena", "Aldo", "Carla", "Ivan", "Rosa", "Miguel", "Patricia"],
  "Chile": ["Rodrigo", "Constanza", "Cristian", "Daniela", "Francisco", "Javiera", "Nicolas", "Valeria", "Andres", "Macarena"],
  "Venezuela": ["Andres", "Maria", "Juan", "Sofia", "Carlos", "Ana", "Miguel", "Isabel", "Luis", "Carolina"],
  "United States": ["Jamie", "Sam", "Alex", "Morgan", "Riley", "Jordan", "Casey", "Taylor", "Avery", "Drew"],
  "Canada": ["Jamie", "Sam", "Alex", "Morgan", "Riley", "Jordan", "Casey", "Taylor", "Avery", "Drew"],
  "United Kingdom": ["Jamie", "Sam", "Alex", "Morgan", "Riley", "Jordan", "Casey", "Taylor", "Avery", "Drew"],
  "Australia": ["Liam", "Olivia", "Jack", "Charlotte", "Noah", "Ava", "James", "Mia", "William", "Amelia"],
  "New Zealand": ["Liam", "Olivia", "Jack", "Charlotte", "Noah", "Isabella", "Lucas", "Sophie", "Ethan", "Emma"],
  "Germany": ["Lukas", "Mia", "Felix", "Hannah", "Leon", "Sophie", "Jonas", "Anna", "Tim", "Laura"],
  "France": ["Louis", "Emma", "Gabriel", "Jade", "Raphaël", "Louise", "Arthur", "Alice", "Lucas", "Chloé"],
  "Spain": ["Alejandro", "Sofia", "Pablo", "Maria", "Daniel", "Lucia", "Carlos", "Julia", "Adrian", "Elena"],
  "Italy": ["Marco", "Sofia", "Luca", "Giulia", "Matteo", "Aurora", "Lorenzo", "Giorgia", "Andrea", "Valentina"],
  "Portugal": ["Joao", "Maria", "Tiago", "Ana", "Miguel", "Inês", "Pedro", "Beatriz", "Ricardo", "Catarina"],
  "Netherlands": ["Daan", "Emma", "Sem", "Mila", "Finn", "Sophie", "Liam", "Julia", "Noah", "Sara"],
  "Sweden": ["Erik", "Emma", "Lars", "Anna", "Karl", "Sara", "Johan", "Maja", "Anders", "Lina"],
  "Norway": ["Lars", "Emma", "Erik", "Nora", "Magnus", "Sofia", "Ola", "Ingrid", "Anders", "Astrid"],
  "Denmark": ["Mikkel", "Emma", "Lars", "Sofie", "Christian", "Sara", "Martin", "Louise", "Peter", "Maja"],
  "Finland": ["Mikko", "Sofia", "Juhani", "Emma", "Olavi", "Aino", "Matti", "Helvi", "Paavo", "Siiri"],
  "Poland": ["Piotr", "Anna", "Krzysztof", "Marta", "Andrzej", "Katarzyna", "Tomasz", "Agnieszka", "Marek", "Barbara"],
  "Russia": ["Alexei", "Natasha", "Dmitri", "Olga", "Ivan", "Anastasia", "Sergei", "Elena", "Viktor", "Maria"],
  "Ukraine": ["Oleksiy", "Olena", "Mykola", "Natalia", "Andriy", "Iryna", "Vasyl", "Oksana", "Dmytro", "Yulia"],
  "Turkey": ["Mehmet", "Ayşe", "Ali", "Fatma", "Ahmet", "Zeynep", "Mustafa", "Elif", "Ibrahim", "Hatice"],
  "Saudi Arabia": ["Mohammed", "Fatima", "Abdullah", "Nora", "Khalid", "Sara", "Ahmed", "Maha", "Omar", "Reem"],
  "UAE": ["Mohammed", "Fatima", "Ahmed", "Maryam", "Khalid", "Aisha", "Omar", "Hessa", "Saif", "Shamsa"],
  "Israel": ["David", "Sarah", "Yosef", "Rachel", "Moshe", "Miriam", "Daniel", "Leah", "Noam", "Tamar"],
  "Iran": ["Ali", "Fateme", "Mohammad", "Zahra", "Hossein", "Maryam", "Reza", "Narges", "Hassan", "Somayeh"],
  "Iraq": ["Mohammed", "Fatima", "Ahmed", "Zainab", "Ali", "Noor", "Hassan", "Mariam", "Omar", "Dina"],
};

const DEFAULT_NAMES = ["Jamie", "Sam", "Alex", "Morgan", "Riley", "Jordan", "Casey", "Taylor", "Avery", "Drew"];

function getNamesForCountry(country: string | null | undefined): string[] {
  if (!country) return DEFAULT_NAMES;
  const exact = COUNTRY_NAMES[country];
  if (exact) return exact;
  const lower = country.toLowerCase();
  for (const [key, names] of Object.entries(COUNTRY_NAMES)) {
    if (key.toLowerCase() === lower) return names;
  }
  return DEFAULT_NAMES;
}

const AGENT_ROLES = [
  { role: "The Skeptic", responseType: "challenge", index: 0 },
  { role: "Risk Analyst", responseType: "risk", index: 1 },
  { role: "The Optimist", responseType: "alternative", index: 2 },
  { role: "Data Detective", responseType: "question", index: 3 },
  { role: "Devil's Advocate", responseType: "alternative", index: 4 },
  { role: "The Historian", responseType: "analysis", index: 5 },
  { role: "Market Analyst", responseType: "analysis", index: 6 },
  { role: "Tech Futurist", responseType: "analysis", index: 7 },
  { role: "Systems Thinker", responseType: "analysis", index: 8 },
  { role: "The Pragmatist", responseType: "analysis", index: 9 },
];

type TopicDomain = 'finance' | 'technology' | 'politics' | 'health' | 'environment' | 'society' | 'business' | 'science' | 'geopolitics' | 'strategy' | 'consulting' | 'macro' | 'entrepreneurship' | 'economy' | 'healthcare' | 'energy' | 'education' | 'food_agriculture' | 'logistics' | 'manufacturing' | 'real_estate' | 'retail' | 'ai_product' | 'product_development' | 'startup_ops' | 'general';

const TOPIC_AGENT_WEIGHTS: Record<TopicDomain, Record<string, number>> = {
  finance: {
    "Market Analyst": 10,
    "Risk Analyst": 9,
    "Data Detective": 8,
    "The Historian": 7,
    "The Skeptic": 6,
    "The Pragmatist": 5,
    "Devil's Advocate": 4,
    "Systems Thinker": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  technology: {
    "Tech Futurist": 10,
    "Data Detective": 9,
    "Systems Thinker": 8,
    "The Skeptic": 7,
    "The Pragmatist": 6,
    "Devil's Advocate": 5,
    "Risk Analyst": 4,
    "The Optimist": 3,
    "Market Analyst": 2,
    "The Historian": 1,
  },
  politics: {
    "The Historian": 10,
    "Systems Thinker": 9,
    "Devil's Advocate": 8,
    "The Skeptic": 7,
    "Risk Analyst": 6,
    "Data Detective": 5,
    "The Optimist": 4,
    "The Pragmatist": 3,
    "Market Analyst": 2,
    "Tech Futurist": 1,
  },
  health: {
    "Risk Analyst": 10,
    "Data Detective": 9,
    "The Skeptic": 8,
    "Systems Thinker": 7,
    "The Historian": 6,
    "The Pragmatist": 5,
    "The Optimist": 4,
    "Devil's Advocate": 3,
    "Market Analyst": 2,
    "Tech Futurist": 1,
  },
  environment: {
    "Systems Thinker": 10,
    "Risk Analyst": 9,
    "The Historian": 8,
    "Data Detective": 7,
    "The Skeptic": 6,
    "Devil's Advocate": 5,
    "Tech Futurist": 4,
    "The Optimist": 3,
    "The Pragmatist": 2,
    "Market Analyst": 1,
  },
  society: {
    "The Historian": 10,
    "Systems Thinker": 9,
    "The Skeptic": 8,
    "Devil's Advocate": 7,
    "The Optimist": 6,
    "Data Detective": 5,
    "Risk Analyst": 4,
    "The Pragmatist": 3,
    "Market Analyst": 2,
    "Tech Futurist": 1,
  },
  business: {
    "The Pragmatist": 10,
    "Market Analyst": 9,
    "Risk Analyst": 8,
    "Data Detective": 7,
    "The Skeptic": 6,
    "Systems Thinker": 5,
    "Devil's Advocate": 4,
    "The Optimist": 3,
    "The Historian": 2,
    "Tech Futurist": 1,
  },
  science: {
    "Data Detective": 10,
    "The Skeptic": 9,
    "Systems Thinker": 8,
    "Tech Futurist": 7,
    "The Historian": 6,
    "Risk Analyst": 5,
    "Devil's Advocate": 4,
    "The Optimist": 3,
    "The Pragmatist": 2,
    "Market Analyst": 1,
  },
  geopolitics: {
    "The Historian": 10,
    "Systems Thinker": 9,
    "Risk Analyst": 8,
    "Devil's Advocate": 7,
    "The Skeptic": 6,
    "Data Detective": 5,
    "Market Analyst": 4,
    "The Pragmatist": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  strategy: {
    "The Pragmatist": 10,
    "Devil's Advocate": 9,
    "Market Analyst": 8,
    "The Skeptic": 7,
    "Systems Thinker": 6,
    "Data Detective": 5,
    "Risk Analyst": 4,
    "The Historian": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  consulting: {
    "The Pragmatist": 10,
    "The Skeptic": 9,
    "Devil's Advocate": 8,
    "Market Analyst": 7,
    "Data Detective": 6,
    "Systems Thinker": 5,
    "Risk Analyst": 4,
    "The Optimist": 3,
    "The Historian": 2,
    "Tech Futurist": 1,
  },
  macro: {
    "Market Analyst": 10,
    "Risk Analyst": 9,
    "The Historian": 8,
    "Data Detective": 7,
    "The Skeptic": 6,
    "Systems Thinker": 5,
    "Devil's Advocate": 4,
    "The Pragmatist": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  entrepreneurship: {
    "The Pragmatist": 10,
    "Devil's Advocate": 9,
    "The Skeptic": 8,
    "Market Analyst": 7,
    "Tech Futurist": 6,
    "Data Detective": 5,
    "Risk Analyst": 4,
    "The Optimist": 3,
    "Systems Thinker": 2,
    "The Historian": 1,
  },
  economy: {
    "Market Analyst": 10,
    "The Historian": 9,
    "Data Detective": 8,
    "Systems Thinker": 7,
    "Risk Analyst": 6,
    "The Skeptic": 5,
    "Devil's Advocate": 4,
    "The Pragmatist": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  healthcare: {
    "Risk Analyst": 10,
    "Data Detective": 9,
    "The Skeptic": 8,
    "Systems Thinker": 7,
    "The Historian": 6,
    "The Pragmatist": 5,
    "The Optimist": 4,
    "Devil's Advocate": 3,
    "Market Analyst": 2,
    "Tech Futurist": 1,
  },
  energy: {
    "Systems Thinker": 10,
    "Tech Futurist": 9,
    "Risk Analyst": 8,
    "The Skeptic": 7,
    "Market Analyst": 6,
    "Data Detective": 5,
    "The Historian": 4,
    "Devil's Advocate": 3,
    "The Pragmatist": 2,
    "The Optimist": 1,
  },
  education: {
    "The Historian": 10,
    "Systems Thinker": 9,
    "The Pragmatist": 8,
    "Data Detective": 7,
    "The Skeptic": 6,
    "Devil's Advocate": 5,
    "The Optimist": 4,
    "Risk Analyst": 3,
    "Market Analyst": 2,
    "Tech Futurist": 1,
  },
  food_agriculture: {
    "Systems Thinker": 10,
    "Risk Analyst": 9,
    "Data Detective": 8,
    "The Pragmatist": 7,
    "Tech Futurist": 6,
    "The Skeptic": 5,
    "The Historian": 4,
    "Devil's Advocate": 3,
    "Market Analyst": 2,
    "The Optimist": 1,
  },
  logistics: {
    "The Pragmatist": 10,
    "Systems Thinker": 9,
    "Tech Futurist": 8,
    "Market Analyst": 7,
    "Data Detective": 6,
    "Risk Analyst": 5,
    "The Skeptic": 4,
    "Devil's Advocate": 3,
    "The Historian": 2,
    "The Optimist": 1,
  },
  manufacturing: {
    "The Pragmatist": 10,
    "Systems Thinker": 9,
    "Risk Analyst": 8,
    "Tech Futurist": 7,
    "Data Detective": 6,
    "Market Analyst": 5,
    "The Skeptic": 4,
    "The Historian": 3,
    "Devil's Advocate": 2,
    "The Optimist": 1,
  },
  real_estate: {
    "Market Analyst": 10,
    "The Pragmatist": 9,
    "Risk Analyst": 8,
    "The Historian": 7,
    "Data Detective": 6,
    "Systems Thinker": 5,
    "The Skeptic": 4,
    "Devil's Advocate": 3,
    "The Optimist": 2,
    "Tech Futurist": 1,
  },
  retail: {
    "Market Analyst": 10,
    "The Pragmatist": 9,
    "Data Detective": 8,
    "The Skeptic": 7,
    "Tech Futurist": 6,
    "Devil's Advocate": 5,
    "Risk Analyst": 4,
    "Systems Thinker": 3,
    "The Optimist": 2,
    "The Historian": 1,
  },
  ai_product: {
    "Tech Futurist": 10,
    "The Pragmatist": 9,
    "The Skeptic": 8,
    "Systems Thinker": 7,
    "Market Analyst": 6,
    "Data Detective": 5,
    "Devil's Advocate": 4,
    "Risk Analyst": 3,
    "The Optimist": 2,
    "The Historian": 1,
  },
  product_development: {
    "The Pragmatist": 10,
    "Market Analyst": 9,
    "The Skeptic": 8,
    "Data Detective": 7,
    "Systems Thinker": 6,
    "Tech Futurist": 5,
    "Devil's Advocate": 4,
    "The Optimist": 3,
    "Risk Analyst": 2,
    "The Historian": 1,
  },
  startup_ops: {
    "The Pragmatist": 10,
    "Risk Analyst": 9,
    "Devil's Advocate": 8,
    "The Skeptic": 7,
    "Market Analyst": 6,
    "Data Detective": 5,
    "The Optimist": 4,
    "Systems Thinker": 3,
    "Tech Futurist": 2,
    "The Historian": 1,
  },
  general: {
    "The Skeptic": 5,
    "Risk Analyst": 5,
    "The Optimist": 5,
    "Data Detective": 5,
    "Devil's Advocate": 5,
    "The Historian": 5,
    "Market Analyst": 5,
    "Tech Futurist": 5,
    "Systems Thinker": 5,
    "The Pragmatist": 5,
  },
};

const TOPIC_KEYWORDS: Record<TopicDomain, string[]> = {
  finance: ["stock", "market", "trade", "invest", "economy", "economic", "financial", "bank", "interest rate", "inflation", "currency", "forex", "crypto", "bitcoin", "revenue", "profit", "loss", "gdp", "debt", "fund", "hedge", "equity", "dividend", "portfolio", "asset"],
  technology: ["tech", "software", "ai", "artificial intelligence", "machine learning", "algorithm", "digital", "app", "platform", "startup", "silicon", "cloud", "data", "code", "programming", "internet", "cyber", "automation", "robot", "hardware", "chip", "semiconductor"],
  politics: ["government", "policy", "election", "political", "democracy", "vote", "president", "minister", "parliament", "congress", "law", "regulation", "legislation", "geopolitic", "diplomacy", "sanction", "treaty", "party", "liberal", "conservative"],
  health: ["health", "medical", "medicine", "disease", "treatment", "drug", "vaccine", "hospital", "patient", "doctor", "cancer", "mental health", "wellness", "nutrition", "diet", "exercise", "pandemic", "virus", "clinical", "pharmaceutical", "symptom"],
  environment: ["climate", "environment", "carbon", "emission", "renewable", "energy", "sustainability", "green", "pollution", "biodiversity", "ecosystem", "deforestation", "ocean", "temperature", "weather", "fossil fuel", "solar", "wind", "nature", "wildlife"],
  society: ["social", "culture", "community", "education", "poverty", "inequality", "race", "gender", "religion", "human rights", "migration", "immigration", "labour", "housing", "crime", "diversity", "inclusion", "welfare", "family", "demographic"],
  business: ["business", "company", "startup", "product", "customer", "sales", "marketing", "brand", "strategy", "competition", "industry", "supply chain", "logistics", "e-commerce", "entrepreneur", "founder", "acquisition", "merger", "valuation", "growth"],
  science: ["research", "study", "experiment", "physics", "chemistry", "biology", "quantum", "space", "universe", "discovery", "theory", "hypothesis", "lab", "scientific", "evidence", "data analysis", "genome", "evolution", "neuroscience", "astronomy"],
  geopolitics: ["geopolitic", "nato", "brics", "sanctions", "taiwan", "ukraine", "china", "russia", "us-china", "multipolar", "unipolarity", "sovereignty", "superpower", "cold war", "deterrence", "alliance", "hegemony", "great power", "diplomacy", "foreign policy", "arms race", "rare earth", "belt and road", "empire", "colonialism", "middle east", "africa", "indo-pacific"],
  strategy: ["strategy", "consulting", "mckinsey", "private equity", "pe firm", "m&a", "merger", "acquisition", "competitive advantage", "moat", "platform", "vertical integration", "outsourcing", "supply chain strategy", "founder-led", "zero-based budgeting", "esg", "shareholder value", "corporate strategy", "market entry", "value creation", "playbook"],
  consulting: ["consulting", "consultant", "mckinsey", "bcg", "bain", "deloitte", "pwc", "kpmg", "ey", "big 4", "billable hour", "professional services", "advisory", "in-house", "strategy team", "slide deck", "framework", "engagement", "partner", "associate", "analyst"],
  macro: ["macro", "recession", "stagflation", "central bank", "federal reserve", "fed", "ecb", "interest rate", "yield curve", "de-dollarisation", "dollar", "reserve currency", "fiscal deficit", "national debt", "debt ceiling", "quantitative easing", "monetary policy", "fiscal policy", "inflation", "deflation", "housing crisis", "credit market", "bond market", "deglobalisation", "demographic"],
  entrepreneurship: ["startup", "founder", "venture capital", "vc", "bootstrapping", "bootstrap", "fundraising", "seed round", "series a", "pitch", "pivot", "product-market fit", "pmf", "entrepreneur", "co-founder", "accelerator", "incubator", "exit", "acquisition", "ipo", "valuation", "lean startup", "mvp", "minimum viable product", "runway", "burn rate", "angel investor", "unicorn", "scale", "growth hacking"],
  economy: ["wage", "income inequality", "labour market", "unemployment", "gig economy", "free trade", "tariff", "automation job", "shareholder primacy", "informal economy", "universal healthcare", "housing affordability", "carbon pricing", "degrowth", "gdp growth", "productivity", "worker", "minimum wage", "wealth gap", "redistribution", "welfare state", "social safety net", "trade deficit", "supply and demand", "microeconomics", "cost of living"],
  healthcare: ["hospital", "readmission", "drug discovery", "pharmaceutical", "clinical trial", "mental health", "preventive care", "precision medicine", "genomics", "telemedicine", "ai diagnosis", "electronic health record", "medicare", "medicaid", "insurance", "patient", "treatment", "chronic disease", "epidemic", "public health", "vaccine", "biotech", "fda", "nhs"],
  energy: ["solar", "wind", "nuclear", "grid storage", "battery", "hydrogen", "fossil fuel", "oil", "gas", "coal", "renewable energy", "clean energy", "net zero", "carbon neutral", "power plant", "electricity", "smart grid", "energy transition", "small modular reactor", "smr", "energy poverty", "microgrids", "decarbonise", "electrification"],
  education: ["university", "degree", "tuition", "school", "teacher", "curriculum", "literacy", "numeracy", "learning", "student loan", "bootcamp", "credential", "online learning", "edtech", "classroom", "higher education", "skill gap", "workforce training", "ai tutor", "personalised learning", "stem"],
  food_agriculture: ["food waste", "food security", "vertical farming", "precision fermentation", "smallholder", "crop", "agriculture", "farming", "fertiliser", "pesticide", "supply chain food", "hunger", "malnutrition", "lab-grown meat", "alternative protein", "cold chain", "food system", "arable land", "irrigation", "soil"],
  logistics: ["supply chain", "last-mile", "shipping", "freight", "port", "container", "warehouse", "inventory", "delivery", "autonomous truck", "drone delivery", "3pl", "fulfilment", "tracking", "fleet", "distribution", "customs", "trade route", "congestion", "carrier"],
  manufacturing: ["factory", "production line", "reshoring", "offshoring", "3d printing", "additive manufacturing", "digital twin", "industry 4.0", "iot", "robotics", "skilled trades", "machinist", "welder", "assembly", "lean manufacturing", "just in time", "quality control", "modular construction", "prefabrication"],
  real_estate: ["property", "housing", "rent", "mortgage", "zoning", "construction", "commercial real estate", "office vacancy", "proptech", "adaptive reuse", "remote work real estate", "home price", "landlord", "tenant", "developer", "urban planning", "infrastructure", "permit", "affordable housing"],
  retail: ["e-commerce", "brick and mortar", "omnichannel", "inventory", "stockout", "overstock", "social commerce", "returns", "fulfilment", "customer experience", "store", "shopper", "amazon", "direct to consumer", "dtc", "loyalty", "retail footprint", "live commerce"],
  ai_product: ["llm", "large language model", "gpt", "claude", "gemini", "openai", "anthropic", "rag", "retrieval augmented", "fine-tuning", "embedding", "vector database", "ai agent", "agentic", "copilot", "ai feature", "ai product", "foundation model", "prompt engineering", "context window", "inference cost", "ai integration", "ai-first", "ai native", "model deployment", "ai tooling", "ai infrastructure", "ai wrapper", "ai application", "multimodal"],
  product_development: ["product roadmap", "product manager", "pm", "user research", "ux", "user experience", "feature", "sprint", "agile", "discovery", "prototyping", "a/b test", "conversion", "retention", "activation", "onboarding", "churn", "nps", "product-led growth", "plg", "jobs to be done", "jtbd", "wireframe", "design sprint", "product strategy", "go-to-market", "gtm", "product analytics", "north star metric", "growth loop"],
  startup_ops: ["hiring", "first hire", "team building", "cap table", "safe", "equity", "dilution", "board", "investor update", "due diligence", "term sheet", "pre-money", "post-money", "burn rate", "runway", "cash flow", "unit economics", "ltv", "cac", "payback period", "operating model", "seed stage", "pre-seed", "series a", "pitch deck", "fundraising", "co-founder", "culture", "remote team", "outsourcing"],
  general: [],
};

function classifyTopic(text: string, podContext?: string): TopicDomain {
  const combined = `${text} ${podContext || ""}`.toLowerCase();
  let bestTopic: TopicDomain = "general";
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as [TopicDomain, string[]][]) {
    if (topic === "general") continue;
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  return bestTopic;
}

function selectContextualAgents(
  eligibleAgents: { id: string; name: string }[],
  topic: TopicDomain,
  count = 3
): { id: string; name: string }[] {
  const weights = TOPIC_AGENT_WEIGHTS[topic] || TOPIC_AGENT_WEIGHTS.general;

  const scored = eligibleAgents.map(agent => ({
    agent,
    score: (weights[agent.name] || 1) + Math.random() * 2,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.agent);
}

function buildPersonaPrompt(role: string, name: string): string {
  switch (role) {
    case "The Skeptic":
      return `You're ${name} — the person in every meeting who quietly raises their hand and says "but wait, have we actually checked that?" You're not cynical, you just don't like when people assume things without proof. You've been burned before by overconfidence.

When you read this assumption, respond as ${name} would: a bit direct, maybe a little dry, but coming from a good place. You want to poke at the weakest part of the argument — the bit that sounds convincing but isn't backed up.

Keep it conversational and brief — like a comment you'd leave on a shared doc. 2-3 sentences. No bullet points. No jargon.

Examples of ${name}'s tone:
- "I get why that seems obvious, but I've seen this exact assumption fall apart twice. What's our actual evidence here?"
- "This might be true — but we're treating it like a fact when it's really just a guess. Worth testing before we build anything around it."`;

    case "Risk Analyst":
      return `You're ${name} — the cautious one who always thinks two steps ahead. You're not a pessimist, you're just the person who packs a charger before a long trip. You've seen plans fall apart because nobody stopped to ask "what if this one thing goes sideways?"

When you read this assumption, respond as ${name} would: calm, practical, focused on the one concrete thing that worries you most. Not a list of everything that could go wrong — just the biggest, realest risk.

Keep it grounded and warm, not alarmist. 2-3 sentences. Like advice from a trusted friend before a big decision.

Examples of ${name}'s tone:
- "The thing that keeps me up about this is the dependency on external partners. If they change pricing or terms, we're exposed and there's not much we can do quickly."
- "This works right up until demand spikes faster than we can handle — and then it becomes a PR problem, not just an ops one."`;

    case "The Optimist":
      return `You're ${name} — the one who genuinely gets excited by good ideas and always finds the real upside that others overlook. You're not blindly positive; you just have a talent for spotting potential that hasn't been fully articulated yet. You temper enthusiasm with honesty.

When you read this assumption, respond as ${name} would: specific about the upside, enthusiastic but grounded. You're not just saying "great idea!" — you're explaining *why* this could work even better than people realise.

Keep it energetic but tight. 2-3 sentences. Like someone leaning forward at the table because they genuinely see something good.

Examples of ${name}'s tone:
- "Honestly, if this plays out the way I think it could, you're not just solving the immediate problem — you're building something customers will actually talk about."
- "The thing people are missing here is that this could compound. Each win makes the next one easier, and that's the kind of momentum that's hard to manufacture."`;

    case "Data Detective":
      return `You're ${name} — the person who, before committing to anything, wants to see the numbers. Not because you're difficult, but because you've seen how much a single data point can change a whole strategy. You ask the question everyone else forgot to ask.

When you read this assumption, respond as ${name} would: zero in on the one missing fact, number, or piece of evidence that would actually tell us whether this is true or not. Be specific — not just "do we have data?" but "what exact data would answer this?"

2-3 sentences. Curious tone, not accusatory. Like a teammate who wants to help strengthen the idea.

Examples of ${name}'s tone:
- "Before I'd feel comfortable building on this, I'd want to know: what percentage of people who tried this actually came back? That one number changes everything."
- "Has anyone actually asked customers to rank this problem against their other frustrations? My gut says we might be overestimating how much it bothers them."`;

    case "Devil's Advocate":
      return `You're ${name} — the one who plays devil's advocate not to be annoying, but because you genuinely think pressure-testing ideas makes them stronger. You'll argue the opposite of what everyone else is saying, and you're usually at least a little bit right.

When you read this assumption, respond as ${name} would: flip it. Make the honest case for why this assumption might be completely wrong. Not "what if it fails?" — but "what if the premise itself is off?"

Short, punchy, a bit provocative but never mean. 2-3 sentences. Like someone at a dinner table who just said "okay but hear me out..."

Examples of ${name}'s tone:
- "What if users don't actually want this feature — what if they just said they did because we asked them in the wrong way? We might be solving a problem that isn't real."
- "Flip it for a second: what if the reason nobody's done this yet isn't oversight, but because everyone who tried it found out why it doesn't work?"`;

    case "The Historian":
      return `You're ${name} — the one who's always got a relevant story. You've read a lot, remember a lot, and you see patterns in things others treat as brand new. When someone pitches an idea, you're already thinking of the three times something similar happened.

When you read this assumption, respond as ${name} would: bring in a real analogy, a past example, or a pattern from history that's genuinely relevant. It doesn't have to be a famous case — even a well-known business story or cultural pattern works. Draw the lesson clearly.

Conversational and storytelling in tone. 2-3 sentences. Like someone who just remembered exactly the right thing to say.

Examples of ${name}'s tone:
- "This is giving me strong Blockbuster vibes — not the business model, but the assumption that customers value convenience less than familiarity. That turned out to be very wrong."
- "Groupon made almost this exact bet in 2012 — that volume could offset thin margins. It worked until it didn't, and the recovery was brutal."`;

    case "Market Analyst":
      return `You're ${name} — sharp, plugged in, and always thinking about what's actually happening out there. You follow trends, you know what competitors are doing, and you have a feel for what the market is ready for (and what it isn't).

When you read this assumption, respond as ${name} would: give your honest read on the market context. Are conditions favourable? Is timing right? Is there a competitor dynamic or consumer shift that matters here?

Direct and clear, no fluff. 2-3 sentences. Like a colleague who just got back from an industry conference and has opinions.

Examples of ${name}'s tone:
- "The market's actually moving in a direction that helps this — but only if you move in the next 6-12 months. After that, larger players will own the category."
- "People are fatigued with this kind of product right now. The bar for standing out has gone up a lot, so 'good enough' won't cut it the way it might have two years ago."`;

    case "Tech Futurist":
      return `You're ${name} — fascinated by where things are going and always thinking about how technology changes the game before most people notice. You're not a nerd about it; you just see how new tools are shifting what's possible and what's expected.

When you read this assumption, respond as ${name} would: point out how something in the technology landscape — something that already exists or is clearly coming — makes this assumption easier, harder, or fundamentally different than it looks.

Keep it grounded in real tech, not sci-fi. 2-3 sentences. Like a friend who says "you know that thing already kind of exists, right?"

Examples of ${name}'s tone:
- "The manual part of this is already being automated by tools that cost almost nothing. That's actually good news — it means the barrier is lower than it looks."
- "The assumption holds for now, but there's a real chance this gets disrupted by voice interfaces in the next couple of years. It's worth building with that possibility in mind."`;

    case "Systems Thinker":
      return `You're ${name} — the person who can't help but see how everything connects. When someone makes a change, you're already thinking three steps ahead about what else will shift as a result. You're not alarmist — you just see systems where others see isolated decisions.

When you read this assumption, respond as ${name} would: point out the knock-on effect or the unintended consequence that follows if this assumption is acted on. What else changes downstream?

Thoughtful and calm. 2-3 sentences. Like someone who says "just thinking out loud, but if we do X, doesn't that also mean Y happens?"

Examples of ${name}'s tone:
- "If this assumption holds and we lean into it, it'll likely change how we hire — and that shift in team culture could end up being the bigger story."
- "The tricky part is that solving this problem in the way we're imagining might create a dependency that's hard to undo later. Just worth naming now."`;

    case "The Pragmatist":
      return `You're ${name} — practical, no-nonsense, and allergic to plans that look good on paper but fall apart in the real world. You've shipped enough things to know the gap between "theoretically possible" and "actually executable" is enormous.

When you read this assumption, respond as ${name} would: be honest about whether this is actually doable with normal people, normal budgets, and normal timelines. Call out the part that's harder than it sounds.

Blunt but not unkind. 2-3 sentences. Like a senior teammate doing a gut check before sign-off.

Examples of ${name}'s tone:
- "This works if someone owns it full-time. In my experience, things with this level of coordination requirement die quietly because no single person is accountable."
- "The concept is solid but the implementation assumes a level of internal alignment that most teams just don't have. Worth figuring that out before committing."`;

    default:
      return `You're ${name} — a thoughtful analyst reviewing this assumption. Give your honest, concise take in 2-3 sentences.`;
  }
}

function getPersonaForAgent(agentName: string, country: string | null | undefined): { systemPrompt: string; responseType: string; displayName: string } {
  const names = getNamesForCountry(country);
  const roleInfo = AGENT_ROLES.find(r => r.role === agentName);
  if (!roleInfo) {
    return { systemPrompt: `You're a thoughtful analyst. Give your honest, concise take in 2-3 sentences.`, responseType: "analysis", displayName: DEFAULT_NAMES[0] };
  }
  const name = names[roleInfo.index] || DEFAULT_NAMES[roleInfo.index];
  return {
    systemPrompt: buildPersonaPrompt(agentName, name),
    responseType: roleInfo.responseType,
    displayName: name,
  };
}

const AGENT_PERSONAS: Record<string, { systemPrompt: string; responseType: string }> = {
  "The Skeptic": { responseType: "challenge", systemPrompt: buildPersonaPrompt("The Skeptic", "Jamie") },
  "Risk Analyst": { responseType: "risk", systemPrompt: buildPersonaPrompt("Risk Analyst", "Sam") },
  "The Optimist": { responseType: "alternative", systemPrompt: buildPersonaPrompt("The Optimist", "Alex") },
  "Data Detective": { responseType: "question", systemPrompt: buildPersonaPrompt("Data Detective", "Morgan") },
  "Devil's Advocate": { responseType: "alternative", systemPrompt: buildPersonaPrompt("Devil's Advocate", "Riley") },
  "The Historian": { responseType: "analysis", systemPrompt: buildPersonaPrompt("The Historian", "Jordan") },
  "Market Analyst": { responseType: "analysis", systemPrompt: buildPersonaPrompt("Market Analyst", "Casey") },
  "Tech Futurist": { responseType: "analysis", systemPrompt: buildPersonaPrompt("Tech Futurist", "Taylor") },
  "Systems Thinker": { responseType: "analysis", systemPrompt: buildPersonaPrompt("Systems Thinker", "Avery") },
  "The Pragmatist": { responseType: "analysis", systemPrompt: buildPersonaPrompt("The Pragmatist", "Drew") },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    const action = body.action || (lastSegment !== "ai-agents" ? lastSegment : null);

    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
    const xCronSecret = req.headers.get("x-cron-secret");

    const isCronRequest = cronSecret != null && (authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret);

    if (action === "agent-discussion" && (isServiceRole || isCronRequest)) {
      const startedAt = Date.now();
      const result = await handleAgentDiscussion(body, supabase);
      phCaptureServer("agent_discussion_completed", "system", {
        latency_ms: Date.now() - startedAt,
        http_status: result.status,
      });
      return result;
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .maybeSingle();
    const userCountry: string | null = profileData?.country ?? null;

    // Actions that call OpenAI are quota-gated. save-context is a DB-only write.
    if (action !== "save-context") {
      const quotaDenied = await checkAndIncrementQuota(user.id, supabase);
      if (quotaDenied) return quotaDenied;
    }

    if (action === "generate") {
      return await handleGenerate(body, supabase, userCountry, user.id);
    }

    if (action === "chat") {
      return await handleChat(body, supabase, userCountry, user.id);
    }

    if (action === "consensus") {
      return await handleConsensus(body, supabase, user.id);
    }

    if (action === "save-context") {
      return await handleSaveUserContext(body, supabase, user.id);
    }

    if (action === "recommend") {
      return await handleRecommend(body, supabase, user.id);
    }

    if (action === "analyze-post") {
      return await handleAnalyzePost(body, supabase, user.id);
    }

    if (action === "weekly-digest") {
      return await handleWeeklyDigest(body, supabase, user.id);
    }

    if (action === "resolve-assumption") {
      return await handleResolveAssumption(body, supabase, user.id);
    }

    if (action === "agent-discussion") {
      return await handleAgentDiscussion(body, supabase);
    }

    if (action === "post-challenge-reply") {
      return await handlePostChallengeReply(body, supabase, userCountry);
    }

    return new Response(JSON.stringify({ error: "Missing or unknown action", action, path: url.pathname }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleResolveAssumption(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId: string) {
  const { assumptionId } = body as { assumptionId: string };

  if (!assumptionId) {
    return new Response(JSON.stringify({ error: "Missing assumptionId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: assumption, error: assumptionError } = await supabase
    .from("pod_assumptions")
    .select("id, content, description, pod_id, created_by, insight_type, pods(name, question_text)")
    .eq("id", assumptionId)
    .maybeSingle();

  if (assumptionError || !assumption) {
    return new Response(JSON.stringify({ error: "Assumption not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existingOutcome } = await supabase
    .from("assumption_outcomes")
    .select("id, outcome, resolved_by_ai")
    .eq("assumption_id", assumptionId)
    .maybeSingle();

  if (existingOutcome) {
    return new Response(JSON.stringify({ error: "Assumption already resolved", outcome: existingOutcome }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existingRequest } = await supabase
    .from("ai_resolution_requests")
    .select("id, status")
    .eq("assumption_id", assumptionId)
    .maybeSingle();

  if (existingRequest?.status === "pending") {
    return new Response(JSON.stringify({ error: "AI resolution already in progress" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isMember } = await supabase
    .from("pod_members")
    .select("id")
    .eq("pod_id", assumption.pod_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!isMember) {
    return new Response(JSON.stringify({ error: "You must be a pod member to request AI resolution" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: agentResponses } = await supabase
    .from("agent_responses")
    .select("content, response_type, confidence_score, ai_agents(name)")
    .eq("assumption_id", assumptionId)
    .order("confidence_score", { ascending: false })
    .limit(6);

  const { data: challenges } = await supabase
    .from("assumption_challenges")
    .select("content, created_at")
    .eq("assumption_id", assumptionId)
    .limit(5);

  const { data: forecasts } = await supabase
    .from("assumption_forecasts")
    .select("probability, rationale")
    .eq("assumption_id", assumptionId)
    .limit(10);

  const pod = assumption.pods as { name: string; question_text: string } | null;

  const agentSummary = (agentResponses || []).map((r: {
    content: string;
    response_type: string;
    confidence_score: number;
    ai_agents: { name: string } | null;
  }) => `- ${r.ai_agents?.name || "Agent"} (${r.response_type}, confidence ${r.confidence_score}%): ${r.content.slice(0, 200)}`).join("\n");

  const challengeSummary = (challenges || []).map((c: { content: string }) => `- ${c.content.slice(0, 150)}`).join("\n");

  const forecastSummary = (forecasts || []).map((f: { probability: number; rationale: string }) =>
    `- ${f.probability}% probability${f.rationale ? `: ${f.rationale.slice(0, 100)}` : ""}`
  ).join("\n");

  const avgForecast = forecasts && forecasts.length > 0
    ? Math.round((forecasts as { probability: number }[]).reduce((sum, f) => sum + f.probability, 0) / forecasts.length)
    : null;

  const insightTypeLabel = (assumption as { insight_type?: string }).insight_type || "General";
  const insightTypeDesc = INSIGHT_TYPE_DESCRIPTIONS[insightTypeLabel] || "statement or observation";

  const systemPrompt = `You are an impartial AI arbiter tasked with resolving whether a strategic ${insightTypeDesc} has been confirmed or refuted based on available evidence.

Your job is to make a definitive verdict — not to hedge. You must choose one of three outcomes:
- "confirmed": The ${insightTypeLabel.toLowerCase()} has held true based on evidence and reasoning
- "refuted": The ${insightTypeLabel.toLowerCase()} has been shown to be wrong or failed to materialise
- "still_open": There is genuinely insufficient evidence to make a call right now

Rules:
1. Be decisive. Only use "still_open" if resolution is truly impossible with current information.
2. Base your verdict on the balance of evidence from AI agent analyses, community challenges, and forecast consensus.
3. Provide a clear reasoning chain (3-4 sentences) explaining why you chose this verdict.
4. Report a confidence score (0-100) reflecting how certain you are of the verdict.
5. Return ONLY valid JSON in this exact format: {"verdict":"confirmed"|"refuted"|"still_open","reasoning":"...","confidence":85}`;

  const userMessage = `Decision room: "${pod?.name || "Unknown"}"
Core question: "${pod?.question_text || "Unknown"}"

${insightTypeLabel} to resolve: "${assumption.content}"
${assumption.description ? `Additional context: ${assumption.description}` : ""}

AI Agent analyses:
${agentSummary || "No agent analyses available"}

Community challenges:
${challengeSummary || "No challenges raised"}

Forecast data:
${forecastSummary || "No forecasts submitted"}
${avgForecast !== null ? `Average forecast probability: ${avgForecast}%` : ""}

Based on all of the above, deliver your verdict.`;

  let verdict: "confirmed" | "refuted" | "still_open" = "still_open";
  let reasoning = "Insufficient evidence to make a definitive determination at this time.";
  let confidence = 40;

  try {
    const raw = await callOpenAI(systemPrompt, userMessage, TOKEN_LIMITS.resolution, true);
    const parsed = JSON.parse(raw);
    if (parsed.verdict && ["confirmed", "refuted", "still_open"].includes(parsed.verdict)) {
      verdict = parsed.verdict;
    }
    if (parsed.reasoning && typeof parsed.reasoning === "string") {
      reasoning = parsed.reasoning;
    }
    if (typeof parsed.confidence === "number") {
      confidence = Math.min(100, Math.max(0, Math.round(parsed.confidence)));
    }
  } catch (_e) {
    // fallback defaults already set
  }

  const systemSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await systemSupabase
    .from("ai_resolution_requests")
    .upsert({
      assumption_id: assumptionId,
      requested_by: userId,
      status: "completed",
      completed_at: new Date().toISOString(),
    }, { onConflict: "assumption_id" });

  const { data: outcomeData, error: outcomeError } = await systemSupabase
    .from("assumption_outcomes")
    .insert({
      assumption_id: assumptionId,
      resolved_by: userId,
      outcome: verdict,
      evidence: reasoning,
      resolved_by_ai: true,
      ai_reasoning: reasoning,
      ai_confidence: confidence,
    })
    .select()
    .single();

  if (outcomeError) {
    await systemSupabase
      .from("ai_resolution_requests")
      .update({ status: "failed" })
      .eq("assumption_id", assumptionId);

    return new Response(JSON.stringify({ error: "Failed to save outcome", detail: outcomeError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ outcome: outcomeData, verdict, reasoning, confidence }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ReferenceLink {
  title: string;
  url: string;
  description: string;
}

async function generateReferenceLinks(
  agentName: string,
  content: string,
  assumptionText: string,
  insightType?: string
): Promise<ReferenceLink[]> {
  const systemPrompt = `You are a research librarian. Given an AI analyst's commentary on a topic, suggest 1-2 real, credible reference links that would genuinely help someone research this further.

Rules:
- Only suggest links that are VERY LIKELY to actually exist (major publications, Wikipedia, Google Scholar, Statista, World Bank, etc.)
- Prefer well-known, stable URLs: en.wikipedia.org, statista.com, ourworldindata.org, hbr.org, mckinsey.com, weforum.org, who.int, worldbank.org, imf.org, nature.com, nytimes.com, ft.com, economist.com, forbes.com, bloomberg.com, investopedia.com, techcrunch.com, mit.edu, stanford.edu
- URLs must be plausible search or topic paths — not made-up article slugs
- For Wikipedia: use the format https://en.wikipedia.org/wiki/Topic_Name
- For search queries: use https://scholar.google.com/scholar?q=query or https://www.google.com/search?q=query
- Keep title under 60 characters
- Keep description under 80 characters

Respond ONLY with valid JSON array:
[
  { "title": "...", "url": "https://...", "description": "..." }
]`;

  const userMsg = `Agent: ${agentName}
Topic insight: "${assumptionText}"
${insightType ? `Type: ${insightType}` : ""}
Agent said: "${content.slice(0, 300)}"

Suggest 1-2 reference links.`;

  try {
    const raw = await callOpenAI(systemPrompt, userMsg, TOKEN_LIMITS.reference_links, true);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 2).filter((l: ReferenceLink) => l.title && l.url && l.url.startsWith("http"));
    }
    return [];
  } catch {
    return [];
  }
}

const DAILY_AI_LIMIT = 100;

// Returns a 429 Response if the user has exceeded their daily limit, otherwise null.
async function checkAndIncrementQuota(
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { error: upsertErr } = await supabase.rpc("increment_daily_ai_usage", {
    p_user_id: userId,
    p_date: today,
  });

  const { data: usageRow } = await supabase
    .from("daily_ai_usage")
    .select("message_count")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const count = usageRow?.message_count ?? 0;

  // Fail closed: any increment error blocks the request. We cannot confirm the
  // usage was recorded, so granting the request would allow quota bypass.
  if (upsertErr || count > DAILY_AI_LIMIT) {
    return new Response(
      JSON.stringify({ error: "Daily AI limit reached. Please try again tomorrow.", quota_exceeded: true }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

// Verifies that userId can access the assumption's pod.
// Returns a 403 Response if denied, otherwise null.
async function checkAssumptionAccess(
  assumptionId: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response | null> {
  const { data: assumption } = await supabase
    .from("pod_assumptions")
    .select("pod_id, pods(is_public)")
    .eq("id", assumptionId)
    .maybeSingle();

  if (!assumption) {
    return new Response(
      JSON.stringify({ error: "Assumption not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const pod = assumption.pods as { is_public: boolean } | null;
  if (pod?.is_public) return null;

  const { data: membership } = await supabase
    .from("pod_members")
    .select("id")
    .eq("pod_id", assumption.pod_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return new Response(
      JSON.stringify({ error: "Access denied: not a member of this pod" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

const TOKEN_LIMITS: Record<string, number> = {
  challenge: 200,
  risk: 200,
  alternative: 220,
  question: 180,
  analysis: 220,
  consensus: 1400,
  resolution: 500,
  recommendation: 1200,
  post_insight: 500,
  topic_generation: 400,
  post_breakthrough: 500,
  post_industry_problem: 600,
  post_opinion: 380,
  post_reply: 280,
  next_steps: 1400,
  research_sources: 600,
  weekly_digest: 250,
  reference_links: 400,
  chat: 280,
  challenge_reply: 280,
};

interface StructuredOutput {
  idea: string;
  assumptions: string[];
  risks: string[];
  counterarguments: string[];
  confidence_score: number;
  disagreement_level: number;
  risk_level: number;
  recommended_action: string;
}

function buildStructuredOutput(
  agentName: string,
  responseType: string,
  rawContent: string,
  _assumptionText: string,
  insightType?: string
): StructuredOutput {
  const lower = rawContent.toLowerCase();

  const HIGH_CONF = ["clearly", "certainly", "definitely", "strong evidence", "data shows", "proven", "consistently", "undeniably"];
  const LOW_CONF = ["uncertain", "unclear", "may", "might", "possibly", "arguably", "difficult to say", "hard to predict", "depends"];
  const HIGH_RISK = ["risk", "danger", "threat", "failure", "collapse", "downside", "catastrophic", "severe", "critical", "warning", "crisis"];
  const CONTRARIAN = ["contrary", "wrong", "misconception", "overlooked", "underestimated", "counterintuitive", "challenge", "disagree", "actually", "in fact", "myth"];

  const count = (signals: string[]) => signals.filter(s => lower.includes(s)).length;

  const TYPE_CONFIDENCE: Record<string, number> = { analysis: 72, challenge: 68, risk: 65, alternative: 70, question: 60 };
  const TYPE_DISAGREEMENT: Record<string, number> = { challenge: 72, alternative: 65, risk: 55, question: 50, analysis: 35 };
  const TYPE_RISK: Record<string, number> = { risk: 75, challenge: 60, alternative: 50, question: 45, analysis: 35 };

  const baseConf = TYPE_CONFIDENCE[responseType] ?? 70;
  const baseDisag = TYPE_DISAGREEMENT[responseType] ?? 50;
  const baseRisk = TYPE_RISK[responseType] ?? 40;

  const confidence_score = Math.min(95, Math.max(40, baseConf + count(HIGH_CONF) * 4 - count(LOW_CONF) * 5));
  const disagreement_level = Math.min(95, Math.max(10, baseDisag + count(CONTRARIAN) * 8));
  const risk_level = Math.min(95, Math.max(10, baseRisk + count(HIGH_RISK) * 6));

  const firstSentence = rawContent.split(/[.!?]/)[0]?.trim() || rawContent.slice(0, 120);
  const idea = firstSentence.length > 15 ? firstSentence : rawContent.slice(0, 120);

  const risks: string[] = [];
  if (responseType === "risk") risks.push(rawContent.slice(0, 180));

  const counterarguments: string[] = [];
  if (responseType === "challenge" || responseType === "alternative") {
    counterarguments.push(rawContent.slice(0, 180));
  }

  const ACTION_VERBS = ["consider", "monitor", "investigate", "evaluate", "test", "validate", "review", "assess", "explore"];
  const foundVerb = ACTION_VERBS.find(v => lower.includes(v));
  const recommended_action = foundVerb
    ? rawContent.slice(lower.indexOf(foundVerb), lower.indexOf(foundVerb) + 80).trim()
    : `Evaluate the ${insightType?.toLowerCase() || "claim"} from ${agentName} before proceeding`;

  const impliedAssumptions: string[] = [];
  if (lower.includes("assum")) impliedAssumptions.push("Current trends continue as projected");
  if (lower.includes("market")) impliedAssumptions.push("Market conditions remain relatively stable");

  return {
    idea,
    assumptions: impliedAssumptions.slice(0, 2),
    risks,
    counterarguments,
    confidence_score,
    disagreement_level,
    risk_level,
    recommended_action,
  };
}

async function callOpenAI(systemPrompt: string, userMessage: string, maxTokens = 300, jsonMode = false, distinctId = "system"): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OpenAI API key not configured");

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.85,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    phCaptureServer("ai_openai_call_failed", distinctId, {
      model: "gpt-4o-mini",
      status: response.status,
      latency_ms: Date.now() - startedAt,
      json_mode: jsonMode,
    });
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  phCaptureServer("ai_openai_call", distinctId, {
    model: "gpt-4o-mini",
    prompt_tokens: data.usage?.prompt_tokens ?? null,
    completion_tokens: data.usage?.completion_tokens ?? null,
    total_tokens: data.usage?.total_tokens ?? null,
    max_tokens: maxTokens,
    json_mode: jsonMode,
    latency_ms: Date.now() - startedAt,
  });
  return data.choices[0].message.content.trim();
}

const INSIGHT_TYPE_DESCRIPTIONS: Record<string, string> = {
  "General": "statement or observation",
  "Idea": "idea or proposed concept",
  "Claim": "claim believed to be true",
  "Hypothesis": "testable hypothesis",
  "Prediction": "prediction about future events",
  "Concern": "concern or risk worth discussing",
  "Opportunity": "opportunity or potential upside",
};

function buildAssumptionContext(assumptionText: string, assumptionDescription?: string, podContext?: string, insightType?: string): string {
  const typeLabel = insightType && insightType !== "General" ? insightType : "Insight";
  const typeDesc = INSIGHT_TYPE_DESCRIPTIONS[insightType || "General"] || "statement or observation";
  let context = `${typeLabel}: "${assumptionText}"\n(This is a ${typeDesc})`;
  if (assumptionDescription && assumptionDescription.trim()) {
    context += `\n\nContext & background: ${assumptionDescription}`;
  }
  if (podContext && podContext.trim()) {
    context += `\n\nDecision room topic: ${podContext}`;
  }
  return context;
}

async function handleSaveUserContext(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId: string) {
  const { assumptionId, expertiseLevel, statedPrior, goals, industryContext, focusAreas } = body as {
    assumptionId: string;
    expertiseLevel?: string;
    statedPrior?: number;
    goals?: string;
    industryContext?: string;
    focusAreas?: string[];
  };

  if (!assumptionId) {
    return new Response(JSON.stringify({ error: "Missing assumptionId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("user_assumption_context")
    .upsert({
      user_id: userId,
      assumption_id: assumptionId,
      expertise_level: expertiseLevel || "intermediate",
      stated_prior: statedPrior ?? null,
      goals: goals || "",
      industry_context: industryContext || "",
      focus_areas: focusAreas || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,assumption_id" })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ context: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleChat(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userCountry?: string | null, userId?: string) {
  const { agentId, agentName, userMessage, assumptionId, assumptionContext, assumptionDescription, podContext, insightType, conversationHistory } = body as {
    agentId?: string;
    agentName: string;
    userMessage: string;
    assumptionId?: string;
    assumptionContext?: string;
    assumptionDescription?: string;
    podContext?: string;
    insightType?: string;
    conversationHistory?: { user: string; agent: string }[];
  };

  if (!agentName || !userMessage) {
    return new Response(JSON.stringify({ error: "Missing agentName or userMessage" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId && assumptionId) {
    const denied = await checkAssumptionAccess(assumptionId, userId, supabase);
    if (denied) return denied;
  }

  const persona = getPersonaForAgent(agentName, userCountry);
  if (!persona) {
    return new Response(JSON.stringify({ error: "Unknown agent" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dbHistory: { role: string; content: string; turn_index: number }[] = [];
  if (userId && assumptionId && agentId) {
    const { data: memRows } = await supabase
      .from("agent_conversation_memory")
      .select("role, content, turn_index")
      .eq("user_id", userId)
      .eq("assumption_id", assumptionId)
      .eq("agent_id", agentId)
      .order("turn_index", { ascending: false })
      .limit(10);
    if (memRows && memRows.length > 0) {
      dbHistory = [...memRows].reverse();
    }
  }

  let userContext: { expertise_level: string; stated_prior: number | null; goals: string; industry_context: string } | null = null;
  if (userId && assumptionId) {
    const { data: ctx } = await supabase
      .from("user_assumption_context")
      .select("expertise_level, stated_prior, goals, industry_context")
      .eq("user_id", userId)
      .eq("assumption_id", assumptionId)
      .maybeSingle();
    userContext = ctx;
  }

  const fullContext = assumptionContext
    ? buildAssumptionContext(assumptionContext, assumptionDescription, podContext, insightType)
    : "";

  const contextBlock = fullContext ? `\n\n${fullContext}\n` : "";

  const userCtxBlock = userContext
    ? `\n\nUser context: expertise=${userContext.expertise_level}${userContext.stated_prior != null ? `, prior belief=${userContext.stated_prior}%` : ""}${userContext.goals ? `, goals: ${userContext.goals}` : ""}${userContext.industry_context ? `, industry: ${userContext.industry_context}` : ""}\n`
    : "";

  const memorySource = dbHistory.length > 0 ? dbHistory : (conversationHistory || []).map((h, i) => [
    { role: "user", content: h.user, turn_index: i * 2 },
    { role: "agent", content: h.agent, turn_index: i * 2 + 1 },
  ]).flat();

  const historyBlock = memorySource.length > 0
    ? "\n\nConversation so far:\n" + memorySource.map((h) =>
        `${h.role === "user" ? "User" : "You"}: ${h.content}`
      ).join("\n\n") + "\n"
    : "";

  const systemPrompt = `${persona.systemPrompt}${contextBlock}${userCtxBlock}${historyBlock}

You're now responding to a follow-up. Stay in character — same casual, direct voice. Be genuinely useful and engage with what they said. No lists, no headers. Just talk like a person. Tailor depth to the user's expertise level if known.`;

  const reply = await callOpenAI(systemPrompt, userMessage as string, TOKEN_LIMITS.chat);
  const confidence = Math.floor(Math.random() * 15) + 75;

  if (userId && assumptionId && agentId) {
    const { data: lastTurn } = await supabase
      .from("agent_conversation_memory")
      .select("turn_index")
      .eq("user_id", userId)
      .eq("assumption_id", assumptionId)
      .eq("agent_id", agentId)
      .order("turn_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = (lastTurn?.turn_index ?? -1) + 1;

    await supabase.from("agent_conversation_memory").insert([
      { user_id: userId, assumption_id: assumptionId, agent_id: agentId, role: "user", content: userMessage, turn_index: nextIndex },
      { user_id: userId, assumption_id: assumptionId, agent_id: agentId, role: "agent", content: reply, turn_index: nextIndex + 1 },
    ]);
  }

  return new Response(JSON.stringify({ reply, confidence }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGenerate(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userCountry?: string | null, userId?: string) {
  const { assumptionId, assumptionText, assumptionDescription, podContext, outcomeContext, insightType } = body as {
    assumptionId: string;
    assumptionText: string;
    assumptionDescription?: string;
    podContext?: string;
    outcomeContext?: string;
    insightType?: string;
  };

  if (!assumptionId || !assumptionText) {
    return new Response(JSON.stringify({ error: "Missing assumptionId or assumptionText" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId) {
    const denied = await checkAssumptionAccess(assumptionId, userId, supabase);
    if (denied) return denied;
  }

  const { data: agents } = await supabase
    .from("ai_agents")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (!agents || agents.length === 0) {
    return new Response(JSON.stringify({ error: "No active agents found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existingResponses } = await supabase
    .from("agent_responses")
    .select("agent_id")
    .eq("assumption_id", assumptionId);

  const agentsWithResponse = new Set((existingResponses || []).map((r: { agent_id: string }) => r.agent_id));
  const eligibleAgents = agents.filter((a: { id: string; name: string }) => !agentsWithResponse.has(a.id));

  if (eligibleAgents.length === 0) {
    return new Response(JSON.stringify({ responses: [], alreadyRan: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch user-specific context to personalise agent prompts
  let userContext: { expertise_level: string; stated_prior: number | null; goals: string; industry_context: string } | null = null;
  if (userId) {
    const { data: ctx } = await supabase
      .from("user_assumption_context")
      .select("expertise_level, stated_prior, goals, industry_context")
      .eq("user_id", userId)
      .eq("assumption_id", assumptionId)
      .maybeSingle();
    userContext = ctx;
  }

  const topic = classifyTopic(assumptionText, podContext);
  const shuffled = selectContextualAgents(eligibleAgents, topic, 3);

  const fullContext = buildAssumptionContext(assumptionText, assumptionDescription, podContext, insightType);
  const outcomeBlock = outcomeContext ? `\n\nIMPORTANT CONTEXT: ${outcomeContext}` : "";

  const userCtxBlock = userContext
    ? `\n\nUser context: expertise=${userContext.expertise_level}${userContext.stated_prior != null ? `, prior belief=${userContext.stated_prior}%` : ""}${userContext.goals ? `, goals: ${userContext.goals}` : ""}${userContext.industry_context ? `, industry: ${userContext.industry_context}` : ""}`
    : "";

  const results = await Promise.allSettled(
    shuffled.map(async (agent: { id: string; name: string }) => {
      const persona = getPersonaForAgent(agent.name, userCountry);
      if (!persona) return null;

      const typeLabel = insightType && insightType !== "General" ? insightType.toLowerCase() : "insight";
      const responseTokenLimit = TOKEN_LIMITS[persona.responseType] ?? TOKEN_LIMITS.analysis;

      const content = await callOpenAI(
        persona.systemPrompt,
        `Here's what you're looking at:\n\n${fullContext}${outcomeBlock}${userCtxBlock}\n\nThis is a ${typeLabel} — respond accordingly. What's your honest take?`,
        responseTokenLimit
      );

      const structured = buildStructuredOutput(agent.name, persona.responseType, content, assumptionText, insightType);
      const confidence = structured.confidence_score;

      const referenceLinks = await generateReferenceLinks(
        agent.name,
        content,
        assumptionText,
        insightType
      );

      const { data, error } = await supabase
        .from("agent_responses")
        .insert({
          agent_id: agent.id,
          assumption_id: assumptionId,
          response_type: persona.responseType,
          content,
          confidence_score: confidence,
          display_name: persona.displayName,
          reference_links: referenceLinks.length > 0 ? referenceLinks : null,
          structured_output: structured,
          disagreement_level: structured.disagreement_level,
          risk_level: structured.risk_level,
        })
        .select()
        .single();

      if (error) throw error;

      await Promise.all([
        createStructuredContent(supabase, agent.id, assumptionId, persona.responseType, content, confidence),
        supabase.from("agent_decision_memory").upsert({
          assumption_id: assumptionId,
          agent_id: agent.id,
          idea: structured.idea,
          assumptions: structured.assumptions,
          risks: structured.risks,
          counterarguments: structured.counterarguments,
          confidence_score: confidence,
          disagreement_level: structured.disagreement_level,
          risk_level: structured.risk_level,
          recommended_action: structured.recommended_action,
          response_type: persona.responseType,
          pod_context: podContext ?? null,
          insight_type: insightType ?? null,
        }, { onConflict: "assumption_id,agent_id" }),
        supabase.from("agent_response_scores").upsert({
          agent_response_id: data.id,
          assumption_id: assumptionId,
          agent_id: agent.id,
          confidence_score: confidence,
          disagreement_level: structured.disagreement_level,
          risk_level: structured.risk_level,
        }, { onConflict: "agent_response_id" }),
      ]);

      return { data, structured };
    })
  );

  const successful = results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<{ data: Record<string, unknown>; structured: StructuredOutput }>).value);

  // Record this as a decision run for history tracking
  if (userId && successful.length > 0) {
    const scores = successful.map((s) => s.structured);
    const avgConfidence = Math.round(scores.reduce((sum, s) => sum + s.confidence_score, 0) / scores.length);
    const avgDisagreement = Math.round(scores.reduce((sum, s) => sum + s.disagreement_level, 0) / scores.length);
    const avgRisk = Math.round(scores.reduce((sum, s) => sum + s.risk_level, 0) / scores.length);

    await supabase.from("agent_decision_runs").insert({
      assumption_id: assumptionId,
      user_id: userId,
      agents_used: shuffled.map((a: { name: string }) => a.name),
      composite_confidence: avgConfidence,
      composite_disagreement: avgDisagreement,
      composite_risk: avgRisk,
      agent_count: successful.length,
      triggered_by: "user",
      run_metadata: { topic, insightType: insightType ?? null },
    });
  }

  return new Response(JSON.stringify({ responses: successful.map((s) => s.data) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleConsensus(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId?: string) {
  const { assumptionId, assumptionText, assumptionDescription, podContext, forceRegenerate, outcomeContext, insightType } = body as {
    assumptionId: string;
    assumptionText: string;
    assumptionDescription?: string;
    podContext?: string;
    forceRegenerate?: boolean;
    outcomeContext?: string;
    insightType?: string;
  };

  if (!assumptionId || !assumptionText) {
    return new Response(JSON.stringify({ error: "Missing assumptionId or assumptionText" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId) {
    const denied = await checkAssumptionAccess(assumptionId, userId, supabase);
    if (denied) return denied;
  }

  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("agent_consensus")
      .select("*")
      .eq("assumption_id", assumptionId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ consensus: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: agentResponses } = await supabase
    .from("agent_responses")
    .select("response_type, content, confidence_score, ai_agents(name, role)")
    .eq("assumption_id", assumptionId)
    .order("created_at", { ascending: true });

  if (!agentResponses || agentResponses.length === 0) {
    return new Response(JSON.stringify({ error: "No agent responses found. Run analysis first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fullContext = buildAssumptionContext(assumptionText, assumptionDescription, podContext, insightType);

  const agentSummary = agentResponses.map((r: {
    response_type: string;
    content: string;
    confidence_score: number;
    ai_agents: { name: string; role: string } | null;
  }) => {
    const name = r.ai_agents?.name || "Someone";
    const role = r.ai_agents?.role || r.response_type;
    return `${name} (${role}) said:\n"${r.content}"`;
  }).join("\n\n");

  const consensusSystemPrompt = `You are synthesizing the output of a panel of AI analysts who have each given their honest take on an assumption. Your job is to map the intellectual landscape of the discussion — not just summarize it.

Your output must capture:

1. VERDICT — the clearest overall signal from the group:
   - "likely_valid" — most people think this holds up and the logic is sound
   - "likely_invalid" — most people have serious, substantive doubts
   - "mixed" — real points on both sides, genuinely unclear
   - "insufficient_data" — the group agrees more evidence is needed

2. CONFIDENCE SCORE — 0 to 100. This must reflect the actual level of agreement and evidence quality in the responses above. Use this rubric:
   - 85-100: Near-unanimous agreement, strong evidence cited, very little dissent
   - 70-84: Clear majority view, minor caveats, mostly aligned reasoning
   - 50-69: Genuine split with substantive arguments on both sides
   - 30-49: More disagreement than agreement, significant uncertainty
   - 0-29: Near-total disagreement or almost no usable evidence
   Do NOT default to 65. Calculate based on how many agents actually agreed and how strong their evidence was.

3. SUMMARY — 2-3 sentences. Plain English. What was the overall mood? What was the core tension?

4. AGREEMENT AREAS — what did the analysts broadly agree on? (even if they disagreed on the conclusion). 2-4 items. Short, clear sentences.

5. POSITIONS — this is the most important part. Identify 2 (or 3 if clearly distinct) named positions the analysts split into. For each position:
   - "label": a short, descriptive name for this viewpoint (e.g. "AI Disrupts Consulting", "Human Edge Remains")
   - "stance": "majority" if more than half hold this view, "minority" if fewer, "split" if roughly equal
   - "agents": array of agent role names (e.g. ["Market Analyst", "The Skeptic"]) who hold this view
   - "view": one sentence — what do they actually believe?
   - "reasoning": one sentence — what is their core reason for believing it?

If there is genuine consensus (all agents agree), you may return only 1 position with stance "majority" and note it in the summary.

Respond ONLY with valid JSON in this exact format — no text outside the JSON:
{
  "verdict": "likely_valid" | "likely_invalid" | "mixed" | "insufficient_data",
  "confidence_score": <number 0-100>,
  "summary": "<2-3 sentence plain-English summary>",
  "agreement_areas": ["<thing they agreed on>", ...],
  "key_points": ["<specific, actionable point>", ...],
  "positions": [
    {
      "label": "<position name>",
      "stance": "majority" | "minority" | "split",
      "agents": ["<agent role>", ...],
      "view": "<one sentence — what they believe>",
      "reasoning": "<one sentence — why>"
    }
  ]
}`;

  const outcomeBlock = outcomeContext ? `\n\nIMPORTANT CONTEXT: ${outcomeContext}` : "";

  const userMessage = `${fullContext}${outcomeBlock}

Here's what each analyst said:

${agentSummary}

Now produce the structured analysis.`;

  const rawResponse = await callOpenAI(consensusSystemPrompt, userMessage, TOKEN_LIMITS.consensus, true);

  let parsed: {
    verdict: string;
    confidence_score: number;
    summary: string;
    key_points: string[];
    agreement_areas: string[];
    positions: {
      label: string;
      stance: string;
      agents: string[];
      view: string;
      reasoning: string;
    }[];
  };

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (_e) {
    parsed = {
      verdict: "mixed",
      confidence_score: 55,
      summary: rawResponse,
      key_points: [],
      agreement_areas: [],
      positions: [],
    };
  }

  const validVerdicts = ["likely_valid", "likely_invalid", "mixed", "insufficient_data"];
  if (!validVerdicts.includes(parsed.verdict)) parsed.verdict = "mixed";
  if (parsed.confidence_score < 0 || parsed.confidence_score > 100) parsed.confidence_score = 55;
  if (!Array.isArray(parsed.agreement_areas)) parsed.agreement_areas = [];
  if (!Array.isArray(parsed.positions)) parsed.positions = [];

  await supabase
    .from("agent_consensus")
    .delete()
    .eq("assumption_id", assumptionId);

  const { data: consensus, error: insertError } = await supabase
    .from("agent_consensus")
    .insert({
      assumption_id: assumptionId,
      verdict: parsed.verdict,
      confidence_score: parsed.confidence_score,
      summary: parsed.summary,
      key_points: parsed.key_points,
      agreement_areas: parsed.agreement_areas,
      positions: parsed.positions,
      agent_count: agentResponses.length,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Write a prediction score record linking this consensus to a decision run
  if (userId) {
    const { data: latestRun } = await supabase
      .from("agent_decision_runs")
      .select("id, composite_confidence, composite_disagreement, composite_risk")
      .eq("assumption_id", assumptionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRun) {
      await supabase.from("assumption_prediction_scores").upsert({
        assumption_id: assumptionId,
        user_id: userId,
        decision_run_id: latestRun.id,
        predicted_verdict: parsed.verdict,
        predicted_confidence: latestRun.composite_confidence ?? parsed.confidence_score,
        predicted_disagreement: latestRun.composite_disagreement ?? null,
        predicted_risk: latestRun.composite_risk ?? null,
      }, { onConflict: "assumption_id,decision_run_id" });
    }
  }

  return new Response(JSON.stringify({ consensus, cached: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRecommend(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId: string) {
  const { threadId, forceRegenerate } = body as {
    threadId: string;
    forceRegenerate?: boolean;
  };

  if (!threadId) {
    return new Response(JSON.stringify({ error: "Missing threadId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("ai_thread_recommendations")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ recommendation: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: thread } = await supabase
    .from("decision_threads")
    .select("id, title, description, stage, success_criteria, pods(name)")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return new Response(JSON.stringify({ error: "Thread not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: paths } = await supabase
    .from("decision_paths")
    .select("id, title, focus, risk_level, upside, notes, is_recommended")
    .eq("thread_id", threadId)
    .order("sort_order", { ascending: true });

  const { data: updates } = await supabase
    .from("decision_thread_updates")
    .select("update_type, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const podName = (thread.pods as { name?: string } | null)?.name || "Unknown";

  let contextBlock = `Decision: "${thread.title}"`;
  if (thread.description) contextBlock += `\nBackground: ${thread.description}`;
  if (thread.success_criteria) contextBlock += `\nSuccess criteria: ${thread.success_criteria}`;
  contextBlock += `\nDecision room: ${podName}`;
  contextBlock += `\nCurrent stage: ${thread.stage}`;

  let pathsBlock = "";
  if (paths && paths.length > 0) {
    pathsBlock = "\n\nDecision paths being considered:\n" + paths.map((p: {
      id: string;
      title: string;
      focus: string;
      risk_level: string;
      upside: string;
      notes: string | null;
      is_recommended: boolean;
    }, i: number) => {
      let s = `Option ${i + 1}: ${p.title}\n  Focus: ${p.focus}\n  Risk: ${p.risk_level}\n  Upside: ${p.upside}`;
      if (p.notes) s += `\n  Notes: ${p.notes}`;
      return s;
    }).join("\n\n");
  }

  const assumptions = (updates || []).filter((u: { update_type: string }) => u.update_type === "assumption_added");
  const risks = (updates || []).filter((u: { update_type: string }) => u.update_type === "risk_added");
  const scenarios = (updates || []).filter((u: { update_type: string }) => u.update_type === "scenario_added");

  let insightsBlock = "";
  if (assumptions.length > 0) {
    insightsBlock += "\nAssumptions the team identified:\n" + assumptions.map((u: { content: string }) => `- ${u.content}`).join("\n");
  }
  if (risks.length > 0) {
    insightsBlock += "\n\nRisks the team flagged:\n" + risks.map((u: { content: string }) => `- ${u.content}`).join("\n");
  }
  if (scenarios.length > 0) {
    insightsBlock += "\n\nScenarios the team considered:\n" + scenarios.map((u: { content: string }) => `- ${u.content}`).join("\n");
  }

  const totalInsights = assumptions.length + risks.length + scenarios.length;
  const hasPaths = paths && paths.length > 0;

  const systemPrompt = `You are a senior strategic advisor helping a team think through an important decision.

You have the decision context, any options on the table, and the team's accumulated insights (assumptions, risks, scenarios). Your job is to:
1. Make a clear recommendation — pick a direction or the strongest option if paths exist. Don't hedge with "it depends".
2. Give a concise, specific rationale grounded in the evidence provided.
3. Surface the key factors that matter most.
4. Flag the risks to watch if this direction is taken.
5. Provide 3-4 concrete next steps the team should take RIGHT NOW to move this decision forward.

Next steps should be practical and specific — things like "Interview 5 customers about X", "Run a 2-week pilot of Y", "Map out the cost of Z option", not vague advice like "do more research".

${hasPaths ? "" : "Since no formal decision paths have been defined yet, base your recommendation on the thread context and insights provided. Recommend the clearest direction and suggest what paths the team should explore."}

Respond ONLY with valid JSON in this exact format — no text outside the JSON:
{
  "recommended_option_number": <1-based integer if paths exist, or 0 if no paths>,
  "recommended_path_title": "<short title for the recommended direction — use the path title if paths exist, or coin a clear direction name if not>",
  "reasoning": "<3-4 sentences explaining why this is the best path, referencing the specific context and trade-offs>",
  "key_factors": ["<factor that drove this decision>", "<another factor>"],
  "risks_to_watch": ["<specific risk to monitor>", "<another risk>"],
  "next_steps": ["<concrete action to take now>", "<another action>", "<another action>"],
  "confidence_score": <50-95>
}`;

  const userMessage = `${contextBlock}${pathsBlock}
${insightsBlock}

Based on everything above, what should the team do and what are the next steps?`;

  const rawResponse = await callOpenAI(systemPrompt, userMessage, TOKEN_LIMITS.recommendation, true);

  let parsed: {
    recommended_option_number: number;
    recommended_path_title: string;
    reasoning: string;
    key_factors: string[];
    risks_to_watch: string[];
    next_steps: string[];
    confidence_score: number;
  };

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (_e) {
    parsed = {
      recommended_option_number: 0,
      recommended_path_title: "Further analysis needed",
      reasoning: rawResponse,
      key_factors: [],
      risks_to_watch: [],
      next_steps: [],
      confidence_score: 65,
    };
  }

  let chosenPathId: string | null = null;
  let chosenPathTitle = parsed.recommended_path_title || "Recommended direction";

  if (hasPaths && parsed.recommended_option_number > 0) {
    const optIdx = Math.max(0, Math.min(parsed.recommended_option_number - 1, paths!.length - 1));
    const chosenPath = paths![optIdx] as { id: string; title: string };
    chosenPathId = chosenPath.id;
    chosenPathTitle = chosenPath.title;
  }

  if (!Array.isArray(parsed.key_factors)) parsed.key_factors = [];
  if (!Array.isArray(parsed.risks_to_watch)) parsed.risks_to_watch = [];
  if (!Array.isArray(parsed.next_steps)) parsed.next_steps = [];
  if (parsed.confidence_score < 0 || parsed.confidence_score > 100) parsed.confidence_score = 70;

  await supabase
    .from("ai_thread_recommendations")
    .delete()
    .eq("thread_id", threadId);

  const { data: recommendation, error: insertError } = await supabase
    .from("ai_thread_recommendations")
    .insert({
      thread_id: threadId,
      recommended_path_id: chosenPathId,
      recommended_path_title: chosenPathTitle,
      reasoning: parsed.reasoning,
      key_factors: parsed.key_factors,
      risks_to_watch: parsed.risks_to_watch,
      next_steps: parsed.next_steps,
      confidence_score: parsed.confidence_score,
      agent_count: totalInsights,
      created_by: userId,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(JSON.stringify({ recommendation, cached: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createStructuredContent(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  assumptionId: string,
  responseType: string,
  content: string,
  confidence: number
) {
  try {
    if (responseType === "challenge") {
      const existing = await supabase
        .from("assumption_challenges")
        .select("id")
        .eq("assumption_id", assumptionId)
        .eq("user_id", agentId)
        .maybeSingle();
      if (!existing.data) {
        await supabase.from("assumption_challenges").insert({
          assumption_id: assumptionId,
          user_id: agentId,
          content,
        });
      }
    } else if (responseType === "risk") {
      const existing = await supabase
        .from("assumption_risks")
        .select("id")
        .eq("assumption_id", assumptionId)
        .eq("created_by", agentId)
        .maybeSingle();
      if (!existing.data) {
        const severity = Math.min(5, Math.max(1, Math.round((100 - confidence) / 15) + 1));
        await supabase.from("assumption_risks").insert({
          assumption_id: assumptionId,
          created_by: agentId,
          description: content,
          severity,
        });
      }
    } else if (responseType === "alternative") {
      const existing = await supabase
        .from("assumption_scenarios")
        .select("id")
        .eq("assumption_id", assumptionId)
        .eq("created_by", agentId)
        .maybeSingle();
      if (!existing.data) {
        await supabase.from("assumption_scenarios").insert({
          assumption_id: assumptionId,
          created_by: agentId,
          description: content,
        });
      }
    } else if (responseType === "question" || responseType === "analysis") {
      const existing = await supabase
        .from("assumption_forecasts")
        .select("id")
        .eq("assumption_id", assumptionId)
        .eq("user_id", agentId)
        .maybeSingle();
      if (!existing.data) {
        await supabase.from("assumption_forecasts").insert({
          assumption_id: assumptionId,
          user_id: agentId,
          probability: confidence,
          justification: content,
        });
      }
    }
  } catch (_err) {
  }
}

async function handleAnalyzePost(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, _userId: string) {
  const { postId, postContent, podNames, forceRegenerate } = body as {
    postId: string;
    postContent: string;
    podNames?: string[];
    forceRegenerate?: boolean;
  };

  if (!postId || !postContent) {
    return new Response(JSON.stringify({ error: "Missing postId or postContent" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("post_ai_insights")
      .select("*")
      .eq("post_id", postId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ insight: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const podContext = podNames && podNames.length > 0
    ? `This post is tagged to these decision rooms: ${podNames.join(", ")}.`
    : "";

  const systemPrompt = `You are an insight extraction AI. Your job is to read a short social post and surface one sharp observation about it — either:

1. The HIDDEN ASSUMPTION buried inside the post — something the author is taking for granted that hasn't been stated or tested. Not obvious. The interesting, implicit belief.

2. A CONTRADICTION or tension — if the post seems to conflict with conventional wisdom, strategic thinking, or known dynamics in its topic area.

Pick whichever is more interesting and useful. Be specific to the actual content — no generic observations.

Respond ONLY with valid JSON:
{
  "insight_type": "assumption" | "contradiction",
  "insight_text": "<2 concise sentences. First: name the assumption or contradiction clearly. Second: why it matters or what's at stake.>",
  "confidence_score": <60-95>
}`;

  const userMessage = `Post: "${postContent}"
${podContext}

What's the sharpest insight here?`;

  const rawResponse = await callOpenAI(systemPrompt, userMessage, TOKEN_LIMITS.post_insight, true);

  let parsed: { insight_type: string; insight_text: string; confidence_score: number };

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (_e) {
    parsed = {
      insight_type: "assumption",
      insight_text: rawResponse,
      confidence_score: 70,
    };
  }

  if (!["assumption", "contradiction"].includes(parsed.insight_type)) {
    parsed.insight_type = "assumption";
  }
  if (parsed.confidence_score < 0 || parsed.confidence_score > 100) {
    parsed.confidence_score = 70;
  }

  const { data: insight, error: insertError } = await supabase
    .from("post_ai_insights")
    .insert({
      post_id: postId,
      insight_type: parsed.insight_type,
      insight_text: parsed.insight_text,
      confidence_score: parsed.confidence_score,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(JSON.stringify({ insight, cached: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleWeeklyDigest(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId: string) {
  const { forceRegenerate } = body as { forceRegenerate?: boolean };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("weekly_digests")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", weekStartStr)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ digest: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: userPods } = await supabase
    .from("pod_members")
    .select("pod_id, pods(id, name, question_text)")
    .eq("user_id", userId);

  const podIds = (userPods || []).map((pm: { pod_id: string }) => pm.pod_id);
  const podMap: Record<string, string> = {};
  (userPods || []).forEach((pm: { pod_id: string; pods: { id: string; name: string; question_text: string } | null }) => {
    if (pm.pods) podMap[pm.pod_id] = pm.pods.name;
  });

  const { data: recentAssumptions } = await supabase
    .from("pod_assumptions")
    .select("id, content, challenge_count, created_at, pod_id, profiles:created_by(full_name, first_name, last_name, username)")
    .in("pod_id", podIds.length > 0 ? podIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("created_at", sevenDaysAgo)
    .order("challenge_count", { ascending: false })
    .limit(20);

  const { data: userAssumptions } = await supabase
    .from("pod_assumptions")
    .select("id, content, challenge_count, created_at, pod_id")
    .eq("created_by", userId)
    .gte("created_at", sevenDaysAgo)
    .order("challenge_count", { ascending: false })
    .limit(10);

  const { data: agentResponses } = await supabase
    .from("agent_responses")
    .select("content, response_type, confidence_score, created_at, ai_agents(name), pod_assumptions(content, pod_id)")
    .in("assumption_id",
      (recentAssumptions || []).slice(0, 10).map((a: { id: string }) => a.id)
    )
    .order("confidence_score", { ascending: false })
    .limit(15);

  const topAssumptions = (recentAssumptions || []).slice(0, 5).map((a: {
    id: string;
    content: string;
    challenge_count: number;
    pod_id: string;
  }) => ({
    id: a.id,
    content: a.content,
    challenge_count: a.challenge_count,
    pod_name: podMap[a.pod_id] || "Unknown pod",
  }));

  const aiHighlights = (agentResponses || []).slice(0, 4).map((r: {
    content: string;
    response_type: string;
    confidence_score: number;
    ai_agents: { name: string } | null;
    pod_assumptions: { content: string; pod_id: string } | null;
  }) => ({
    agent_name: r.ai_agents?.name || "AI Agent",
    response_type: r.response_type,
    snippet: r.content.slice(0, 120) + (r.content.length > 120 ? "..." : ""),
    confidence_score: r.confidence_score,
    assumption_snippet: r.pod_assumptions?.content?.slice(0, 80) || "",
    pod_name: r.pod_assumptions?.pod_id ? (podMap[r.pod_assumptions.pod_id] || "") : "",
  }));

  const podChanges = (userPods || []).slice(0, 5).map((pm: {
    pod_id: string;
    pods: { id: string; name: string; question_text: string } | null;
  }) => {
    const podAssumptions = (recentAssumptions || []).filter((a: { pod_id: string }) => a.pod_id === pm.pod_id);
    return {
      pod_name: pm.pods?.name || "Unknown",
      pod_id: pm.pod_id,
      new_assumptions: podAssumptions.length,
      question: pm.pods?.question_text || "",
    };
  }).filter((pc: { new_assumptions: number }) => pc.new_assumptions > 0);

  const assumptionCount = (recentAssumptions || []).length;
  const podCount = podChanges.length;
  const topAgentName = aiHighlights[0]?.agent_name || "The Skeptic";
  const topAssumptionSnippet = topAssumptions[0]?.content?.slice(0, 60) || "";

  const digestSystemPrompt = `You are writing a short, punchy weekly digest for someone using a strategic decision-making platform. Keep it warm, direct, and useful. No corporate speak. 3 sentences max.

Mention: how many insights came through, any active decisions, and one specific observation that would actually be useful to them.`;

  const digestUserMessage = `This week:
- ${assumptionCount} new insights posted across ${podCount} active decisions
- Top AI responder this week: ${topAgentName}
- Most discussed insight: "${topAssumptionSnippet}"
- User's own insights this week: ${(userAssumptions || []).length}

Write their weekly summary.`;

  const { data: recentAgentPosts } = await supabase
    .from("posts")
    .select("id, content, agent_post_title, created_at, agent_discussion_id")
    .eq("is_agent_post", true)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  const agentPosts = (recentAgentPosts || []).map((p: {
    id: string;
    content: string;
    agent_post_title: string | null;
    created_at: string;
    agent_discussion_id: string | null;
  }) => ({
    id: p.id,
    title: p.agent_post_title || "AI Discussion",
    snippet: p.content.slice(0, 140) + (p.content.length > 140 ? "..." : ""),
    created_at: p.created_at,
    discussion_id: p.agent_discussion_id,
  }));

  let summaryText = "";
  try {
    summaryText = await callOpenAI(digestSystemPrompt, digestUserMessage, TOKEN_LIMITS.weekly_digest);
  } catch (_e) {
    summaryText = `You had an active week. ${assumptionCount} new insights came through across ${podCount} decisions you're part of, with ${aiHighlights.length} notable AI insights surfaced. Check what's been challenged — that's where the most useful thinking lives.`;
  }

  await supabase
    .from("weekly_digests")
    .delete()
    .eq("user_id", userId)
    .eq("week_start", weekStartStr);

  const { data: digest, error: insertError } = await supabase
    .from("weekly_digests")
    .insert({
      user_id: userId,
      top_assumptions: topAssumptions,
      ai_highlights: aiHighlights,
      pod_changes: podChanges,
      agent_posts: agentPosts,
      summary_text: summaryText,
      week_start: weekStartStr,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(JSON.stringify({ digest, cached: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePostChallengeReply(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userCountry?: string | null) {
  const { commentId, postId, discussionId, challengeContent, postContent, topicTitle } = body as {
    commentId: string;
    postId: string;
    discussionId: string;
    challengeContent: string;
    postContent?: string;
    topicTitle?: string;
  };

  if (!commentId || !postId || !challengeContent) {
    return new Response(JSON.stringify({ error: "Missing commentId, postId, or challengeContent" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existing } = await supabase
    .from("post_comment_ai_replies")
    .select("id")
    .eq("comment_id", commentId)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ error: "Already replied to this comment" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const topic = classifyTopic(challengeContent, topicTitle);
  const candidateAgents = ["The Skeptic", "Devil's Advocate", "Risk Analyst", "Data Detective", "The Pragmatist", "Systems Thinker"];
  const weights = TOPIC_AGENT_WEIGHTS[topic];
  const sorted = [...candidateAgents].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
  const pickedAgent = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
  const persona = getPersonaForAgent(pickedAgent, userCountry);

  const roleInfo = AGENT_ROLES.find(r => r.role === pickedAgent);
  const agentRole = roleInfo ? roleInfo.responseType : "analysis";

  const systemPrompt = `${persona.systemPrompt}

A user has challenged an AI-generated analysis you were part of. Your job is to respond thoughtfully — not defensively. You must:
1. Acknowledge what is valid or interesting in their challenge
2. Reassess or update your thinking if they raise a good point
3. Explain your updated or maintained reasoning clearly
4. Be honest if the challenge exposes a real weakness in the original analysis

Be direct, conversational, 3-4 sentences. No lists, no headers. Show genuine intellectual engagement — this demonstrates the system is learning and improving, not just defending itself.`;

  const userMessage = `Topic: "${topicTitle || "the discussion"}"

The original AI analysis summary:
"${postContent || "not provided"}"

A user challenged this with:
"${challengeContent}"

Acknowledge their challenge, reassess where valid, update your reasoning, and explain your thinking.`;

  let content: string;
  try {
    content = await callOpenAI(systemPrompt, userMessage, TOKEN_LIMITS.challenge_reply);
  } catch (_e) {
    content = "That's a fair point worth taking seriously. The original analysis may have been too confident in this area — your challenge highlights a genuine uncertainty we should weigh more carefully.";
  }

  const { data: reply, error: insertError } = await supabase
    .from("post_comment_ai_replies")
    .insert({
      comment_id: commentId,
      post_id: postId,
      agent_name: pickedAgent,
      display_name: persona.displayName,
      agent_role: agentRole,
      content,
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: String(insertError.message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    reply: {
      agentName: pickedAgent,
      displayName: persona.displayName,
      agentRole,
      content,
    }
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAgentDiscussion(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { topicId, discussionId } = body as { topicId?: string; discussionId?: string };

  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (discussionId) {
    const { data: existingDiscussion } = await serviceSupabase
      .from("ai_agent_discussions")
      .select("*")
      .eq("id", discussionId)
      .maybeSingle();
    if (!existingDiscussion) {
      return new Response(JSON.stringify({ error: "Discussion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ discussion: existingDiscussion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: allAgents } = await serviceSupabase
    .from("ai_agents")
    .select("id, name")
    .eq("is_active", true);

  if (!allAgents || allAgents.length === 0) {
    return new Response(JSON.stringify({ error: "No active agents found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const AGENT_ORDER = [
    "The Skeptic", "Risk Analyst", "The Optimist", "Data Detective",
    "Devil's Advocate", "The Historian", "Market Analyst", "Tech Futurist",
    "Systems Thinker", "The Pragmatist",
  ];

  const orderedAgents = AGENT_ORDER
    .map(name => allAgents.find(a => a.name === name))
    .filter(Boolean) as { id: string; name: string }[];

  if (orderedAgents.length === 0) {
    return new Response(JSON.stringify({ error: "No matching agents found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: queueRow } = await serviceSupabase
    .from("agent_posting_queue")
    .select("next_agent_index")
    .eq("id", 1)
    .maybeSingle();

  const currentIndex = queueRow?.next_agent_index ?? 0;
  const safeIndex = currentIndex % orderedAgents.length;
  const posterAgent = orderedAgents[safeIndex];
  const nextIndex = (safeIndex + 1) % orderedAgents.length;

  await serviceSupabase
    .from("agent_posting_queue")
    .upsert({ id: 1, next_agent_index: nextIndex, updated_at: new Date().toISOString() });

  let topic: { id: string; title: string; description: string; domain: string; post_type: string; continent?: string | null } | null = null;

  if (topicId) {
    const { data } = await serviceSupabase
      .from("agent_topics")
      .select("id, title, description, domain, post_type, continent")
      .eq("id", topicId)
      .eq("is_active", true)
      .maybeSingle();
    topic = data;
  } else {
    const { data: recentDiscussions } = await serviceSupabase
      .from("ai_agent_discussions")
      .select("topic_title")
      .order("created_at", { ascending: false })
      .limit(80);

    const recentTitles = (recentDiscussions ?? []).map((d: { topic_title: string }) => d.topic_title).filter(Boolean);

    const ALL_DOMAINS = [
      // Core focus — AI, product, startup (60% of picks via repetition)
      "ai_product", "ai_product", "ai_product",
      "product_development", "product_development", "product_development",
      "startup_ops", "startup_ops", "startup_ops",
      "entrepreneurship", "entrepreneurship", "entrepreneurship",
      "technology", "technology", "technology",
      "strategy", "strategy",
      // Broader context domains (40%)
      "finance", "business", "economy",
    ];
    const ALL_POST_TYPES = ["breakthrough_idea", "industry_problem", "opinion"];
    const ALL_CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania", null];

    const randomDomain = ALL_DOMAINS[Math.floor(Math.random() * ALL_DOMAINS.length)];
    const randomPostType = ALL_POST_TYPES[Math.floor(Math.random() * ALL_POST_TYPES.length)];
    // 40% chance of a continent-specific topic, 60% global
    const randomContinent = Math.random() < 0.4
      ? ALL_CONTINENTS[Math.floor(Math.random() * (ALL_CONTINENTS.length - 1))]
      : null;

    const continentContext = randomContinent
      ? `\nContinent focus: ${randomContinent} — the topic must be specifically about challenges, opportunities, or dynamics in ${randomContinent}. Ground it in real conditions on that continent.`
      : `\nContinent focus: Global — the topic should be relevant across multiple regions or have worldwide implications.`;

    const domainContext: Record<string, string> = {
      ai_product: "AI product strategy, LLM deployment, RAG architectures, AI agents, inference economics, AI-native product design, foundation model selection, prompt engineering at scale, AI UX patterns, and building with OpenAI/Anthropic/Gemini APIs",
      product_development: "product strategy for startups, product-market fit discovery, B2B and B2C product design, PLG mechanics, user onboarding, retention loops, product analytics, roadmap prioritisation, jobs-to-be-done, and feature velocity",
      startup_ops: "early-stage startup operations, cap table mechanics, hiring first employees, burn rate management, fundraising strategy, investor relations, SAFEs vs priced rounds, board dynamics, co-founder conflicts, and building culture at speed",
      entrepreneurship: "founder psychology, startup tactics, bootstrapping vs VC-backed paths, pivoting, building in public, community-led growth, niche market domination, solo founder playbooks, and what actually kills startups",
      technology: "developer tools, AI infrastructure, cloud architecture, API-first businesses, open source strategy, technical debt at scale, engineering culture, and software product decisions",
      strategy: "competitive positioning for startups, go-to-market strategy, category creation, pricing strategy, distribution moats, network effects, and startup vs incumbent dynamics",
      finance: "startup financing, venture capital economics, SAFE notes, venture debt, revenue-based financing, financial modelling for founders, unit economics, and startup valuation",
      business: "business model innovation, B2B sales motion, channel strategy, partnerships, SaaS metrics, marketplace dynamics, and enterprise vs SMB positioning",
      economy: "the impact of AI on labour, founder economy trends, remote work economics, creator economy, the gig economy for knowledge workers, and macro trends affecting startups",
    };

    const topicGenSystemPrompt = `You are the editorial director of a high-signal publication for founders, startup operators, and product builders — think a blend of Lenny's Newsletter, First Round Review, and a top VC's thought leadership unit.

Your audience: early-stage founders, product managers, startup engineers, and operators building AI-powered products. They are smart, time-poor, and allergic to generic MBA content.

Your task: generate a single, genuinely original topic for an AI agent to post about.

Domain: ${randomDomain}
Domain focus: ${domainContext[randomDomain] || "AI, product development, and startups"}
Post type: ${randomPostType}${continentContext}

POST TYPE DEFINITIONS:
- "breakthrough_idea": A concrete, non-obvious idea that could change how a founder or product team operates. Must be specific, immediately actionable, and intellectually surprising — not just "use AI more".
- "industry_problem": A real, structural problem that founders or product teams face that is under-diagnosed, widely accepted as normal, or wrongly attributed to the wrong cause.
- "opinion": A sharp, evidence-backed take that challenges received wisdom in startup/product/AI circles. Must have a clear, debatable thesis a founder would want to argue about.

RULES:
1. The title must be a bold, specific claim or question — 8–15 words. No vague generalities. No clickbait.
2. The description must be 2–3 sentences of dense context: why this matters RIGHT NOW for founders/builders, what the tension is, and what makes it intellectually interesting.
3. NEVER generate anything similar to these recently used titles: ${recentTitles.slice(0, 40).map(t => `"${t}"`).join(", ")}
4. Topics must be relevant to people BUILDING companies and products — not investors, journalists, or academics.
5. The topic must feel fresh and practitioner-focused, not recycled from generic startup advice or hot takes.
6. If a continent is specified, anchor it in startup/tech ecosystem dynamics of that continent (e.g. African fintech infrastructure, Southeast Asian super-app models, European AI regulation impact on founders).

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{"title": "...", "description": "...", "domain": "${randomDomain}", "post_type": "${randomPostType}", "continent": ${randomContinent ? `"${randomContinent}"` : "null"}}`;

    const topicGenUserMessage = `Generate one original, high-quality topic for domain "${randomDomain}" with post type "${randomPostType}"${randomContinent ? ` focused on ${randomContinent}` : ""}. Make it genuinely interesting and non-obvious.`;

    let generatedTopic: { title: string; description: string; domain: string; post_type: string; continent?: string | null } | null = null;
    try {
      const raw = await callOpenAI(topicGenSystemPrompt, topicGenUserMessage, TOKEN_LIMITS.topic_generation, true);
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      generatedTopic = JSON.parse(cleaned);
    } catch (_e) {
      generatedTopic = null;
    }

    if (generatedTopic && generatedTopic.title && generatedTopic.description) {
      const { data: inserted } = await serviceSupabase
        .from("agent_topics")
        .insert({
          title: generatedTopic.title,
          description: generatedTopic.description,
          domain: generatedTopic.domain || randomDomain,
          post_type: generatedTopic.post_type || randomPostType,
          continent: generatedTopic.continent ?? randomContinent ?? null,
          is_active: true,
          used: true,
          used_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .select("id, title, description, domain, post_type, continent")
        .single();
      topic = inserted ?? null;
    }

    if (!topic) {
      const { data: fallbackTopics } = await serviceSupabase
        .from("agent_topics")
        .select("id, title, description, domain, post_type, continent")
        .eq("is_active", true)
        .eq("used", false)
        .order("created_at", { ascending: true })
        .limit(20);

      if (fallbackTopics && fallbackTopics.length > 0) {
        topic = fallbackTopics[Math.floor(Math.random() * Math.min(fallbackTopics.length, 5))];
      } else {
        await serviceSupabase
          .from("agent_topics")
          .update({ used: false, used_at: null })
          .eq("is_active", true);

        const { data: resetTopics } = await serviceSupabase
          .from("agent_topics")
          .select("id, title, description, domain, post_type, continent")
          .eq("is_active", true)
          .order("random()")
          .limit(5);

        topic = resetTopics?.[0] ?? null;
      }
    }
  }

  if (!topic) {
    return new Response(JSON.stringify({ error: "Unable to generate or find a topic" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (topic.id) {
    await serviceSupabase
      .from("agent_topics")
      .update({ last_used_at: new Date().toISOString(), used: true, used_at: new Date().toISOString() })
      .eq("id", topic.id);
  }

  const persona = getPersonaForAgent(posterAgent.name, null);
  const postType = topic.post_type || "opinion";

  const PERSONA_ANGLES: Record<string, string> = {
    "The Skeptic": "Lead with what founders and builders are getting wrong about this. Identify the assumption that sounds obvious but isn't backed up — the thing everyone repeats but nobody has actually tested.",
    "Risk Analyst": "Frame this through the lens of what kills startups. What's the specific failure mode here, and which founders are sleepwalking toward it right now?",
    "The Optimist": "Find the genuine upside that the cynics are missing. Make a concrete case for why this is a bigger opportunity for founders and builders than the consensus thinks.",
    "Data Detective": "Ground your take in a specific metric, benchmark, or empirical finding from the startup or product world. Call out where founder intuition diverges from what the data actually shows.",
    "Devil's Advocate": "Take the position that contradicts the dominant startup narrative. Argue for the uncomfortable truth that most founders don't want to hear but need to.",
    "The Historian": "Draw a parallel to a past product, company, or technology cycle that most founders haven't studied. What does history tell us about how this plays out?",
    "Market Analyst": "Think through the competitive and commercial implications for founders building in this space right now. Who wins, who loses, and what does the timing mean for a startup entering today?",
    "Tech Futurist": "Focus on how the underlying technology capability curve changes the product and business model possibilities. What can founders build in 12 months that was impossible 12 months ago?",
    "Systems Thinker": "Identify the second-order effects for founders who act on this. What changes downstream in their team, their product, or their market if they take this seriously?",
    "The Pragmatist": "Cut through the theory to what a founder with limited time and budget can actually do with this insight this week. Name the specific action, not the principle.",
  };

  const personaAngle = PERSONA_ANGLES[posterAgent.name] || "Share your sharpest, most specific angle on this topic.";

  let postSystemPrompt: string;
  let postUserMessage: string;
  const postTokenMap: Record<string, number> = {
    breakthrough_idea: TOKEN_LIMITS.post_breakthrough,
    industry_problem: TOKEN_LIMITS.post_industry_problem,
    opinion: TOKEN_LIMITS.post_opinion,
  };

  if (postType === "breakthrough_idea") {
    postSystemPrompt = `${persona.systemPrompt}

You are presenting a breakthrough idea to a smart, senior professional audience. Your post must reflect your specific persona and analytical lens — not generic enthusiasm.

Your angle: ${personaAngle}

Rules:
- 4-5 sentences maximum
- No bullet points, no headers, no em-dash lists
- Open with the core idea as a concrete, testable claim — not a question, not a hedge
- Explain the specific mechanism: what exactly changes, for whom, and why now
- End with a sharp implication that a practitioner can act on today
- NEVER begin with "I" — start with the idea itself
- Write at the level of a senior professional who has seen hype cycles come and go`;

    postUserMessage = `Breakthrough idea: "${topic.title}"

Background: ${topic.description}

Present this through your specific lens as ${posterAgent.name}. Make it concrete, useful, and worth sharing.`;

  } else if (postType === "industry_problem") {
    postSystemPrompt = `${persona.systemPrompt}

You are diagnosing a costly, structural industry problem and proposing a credible solution. Your post must reflect your specific persona and analytical lens.

Your angle: ${personaAngle}

Rules:
- 5-6 sentences maximum
- No bullet points, no headers
- Open with the scale of the problem — use a specific number or consequence if possible
- Name the root cause in one precise sentence
- Propose the most credible solution path with enough specificity that a practitioner could act on it
- Close by naming who needs to move and what the cost of inaction is
- Write with the authority of someone who has worked in or around this industry`;

    postUserMessage = `Industry problem: "${topic.title}"

Context: ${topic.description}

Diagnose this problem and propose a concrete solution. Approach it as ${posterAgent.name}.`;

  } else {
    postSystemPrompt = `${persona.systemPrompt}

You are sharing a standalone opinion post with a smart, professional audience. This is your personal take — not a balanced analysis, not a report.

Your angle: ${personaAngle}

Rules:
- 3-4 sentences maximum
- No bullet points, no headers
- Start with a strong, contestable claim — not a question, not a hedge
- Every sentence must add something: no filler, no throat-clearing
- NEVER begin with "I" — start with the claim itself
- Write to provoke a reaction: make the reader want to respond`;

    postUserMessage = `Topic: "${topic.title}"

Context: ${topic.description}

Write your sharpest take as ${posterAgent.name}. Make it worth arguing about.`;

  }

  let postContent: string;
  try {
    postContent = await callOpenAI(postSystemPrompt, postUserMessage, postTokenMap[postType] ?? TOKEN_LIMITS.post_opinion);
  } catch (_e) {
    postContent = `${topic.title} — ${topic.description}`;
  }

  let nextStepsJson: string | null = null;
  if (postType === "breakthrough_idea") {
    try {
      const nextStepsSystemPrompt = `You are a world-class strategic intelligence analyst — combining the rigour of McKinsey, the commercial acuity of a top-tier VC, and the hands-on execution experience of a founder who has built and scaled companies. Your job is to produce the highest-quality, most immediately useful action intelligence possible for a breakthrough idea.

You will receive a breakthrough idea with its domain, discussion context, and an analytical post. Your task: produce exactly 5 distinct, deeply researched next steps that real people can act on RIGHT NOW.

QUALITY STANDARDS — every step MUST meet all of these:
1. SPECIFICITY: Name exact tools, platforms, methodologies, metrics or organisations — never vague generalities like "research the market" or "talk to customers". Say WHO to talk to, HOW, and WHAT to measure.
2. DIFFERENTIATION: Each of the 5 steps must serve a DIFFERENT actor type (e.g., early-stage founder, enterprise strategist, impact investor, policy maker, researcher) — cover the full ecosystem.
3. SEQUENCING: Steps should reflect a logical progression — from fastest/cheapest validation actions to longer-horizon structural moves.
4. DOMAIN-AWARENESS: Steps must reflect the specific realities of the idea's domain (regulatory environment, capital cycles, talent markets, technology readiness levels).
5. CONTRARIAN EDGE: At least one step should challenge conventional wisdom or exploit a non-obvious angle that most people would miss.

TIMEFRAME RULES (be precise — pick the one that best matches actual execution time):
- "This week" = can be done in 1-5 days, no capital required, primarily research or outreach
- "30 days" = requires a few weeks of focus, small budget or team, produces a tangible output or validated signal
- "3-6 months" = requires dedicated resource allocation, produces meaningful proof of concept or market position
- "12 months" = structural commitment — product, partnership, policy, fund, or infrastructure build

OUTPUT FORMAT — return ONLY a valid JSON array with exactly 5 objects. Each object has exactly these fields:
- "step": action title, 5-9 words, starts with a strong verb (Build / Map / Run / Launch / Secure / Pilot / Commission / Negotiate)
- "detail": 2 sentences max — sentence 1: precisely what to do and how; sentence 2: the specific outcome or signal this produces (max 40 words total)
- "who": the exact role or organisation type best placed to execute this (be specific — e.g. "Seed-stage founders in B2B SaaS" not just "founders"; "NHS procurement leads" not just "healthcare organisations")
- "timeframe": exactly one of "This week", "30 days", "3-6 months", "12 months"

Return a single JSON object with one key "steps" whose value is the array of exactly 5 step objects.`;

      const nextStepsUserMessage = `DOMAIN: ${topic.domain}

BREAKTHROUGH IDEA: "${topic.title}"

CONTEXT: ${topic.description}

ANALYTICAL POST:
${postContent}

Produce 5 state-of-the-art action steps. Return JSON in this exact shape: {"steps":[{"step":"...","detail":"...","who":"...","timeframe":"..."}, ...]}`;

      const extractStepsArray = (raw: string): unknown[] | null => {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const tryParse = (s: string): unknown[] | null => {
          try {
            const p = JSON.parse(s);
            if (Array.isArray(p)) return p;
            if (p && typeof p === "object" && Array.isArray((p as { steps?: unknown[] }).steps)) {
              return (p as { steps: unknown[] }).steps;
            }
          } catch (_e) { /* fallthrough */ }
          return null;
        };
        const direct = tryParse(cleaned);
        if (direct) return direct;
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const fromArr = tryParse(arrMatch[0]);
          if (fromArr) return fromArr;
        }
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const fromObj = tryParse(objMatch[0]);
          if (fromObj) return fromObj;
        }
        return null;
      };

      let parsedSteps: unknown[] | null = null;
      for (let attempt = 0; attempt < 2 && !parsedSteps; attempt++) {
        try {
          const nextStepsRaw = await callOpenAI(
            nextStepsSystemPrompt,
            nextStepsUserMessage,
            TOKEN_LIMITS.next_steps,
            true,
          );
          const candidate = extractStepsArray(nextStepsRaw);
          if (candidate && candidate.length >= 3) {
            parsedSteps = candidate.slice(0, 5);
          }
        } catch (_e) { /* retry once */ }
      }
      nextStepsJson = parsedSteps ? JSON.stringify(parsedSteps) : null;
    } catch (_e) {
      nextStepsJson = null;
    }
  }

  const { data: discussion, error: createError } = await serviceSupabase
    .from("ai_agent_discussions")
    .insert({
      topic_id: topic.id,
      topic_title: topic.title,
      topic_description: topic.description,
      discussion_status: "in_progress",
      agent_ids: [posterAgent.id],
      agent_names: [posterAgent.name],
      agent_display_names: [persona.displayName],
      turn_count: 0,
    })
    .select()
    .single();

  if (createError || !discussion) {
    return new Response(JSON.stringify({ error: "Failed to create discussion record" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: post, error: postError } = await serviceSupabase
    .from("posts")
    .insert({
      author_id: await resolveAgentUserId(serviceSupabase, posterAgent.id),
      content: postContent,
      is_agent_post: true,
      agent_discussion_id: discussion.id,
      agent_post_title: topic.title,
      post_type: postType,
      post_domain: topic.domain,
      continent: topic.continent ?? null,
      next_steps: nextStepsJson,
    })
    .select()
    .single();

  if (postError || !post) {
    await serviceSupabase
      .from("ai_agent_discussions")
      .update({ discussion_status: "completed", completed_at: new Date().toISOString() })
      .eq("id", discussion.id);

    return new Response(JSON.stringify({ discussion, warning: "Post creation failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await serviceSupabase
    .from("ai_agent_discussions")
    .update({
      discussion_status: "completed",
      completed_at: new Date().toISOString(),
      post_id: post.id,
    })
    .eq("id", discussion.id);

  const otherAgents = orderedAgents.filter(a => a.id !== posterAgent.id);
  const shuffled = otherAgents.sort(() => Math.random() - 0.5).slice(0, 5);
  const conversationHistory: { agentName: string; displayName: string; content: string }[] = [];

  const openerPersona = getPersonaForAgent(posterAgent.name, null);
  await serviceSupabase
    .from("ai_agent_discussion_turns")
    .insert({
      discussion_id: discussion.id,
      agent_id: posterAgent.id,
      agent_name: posterAgent.name,
      display_name: openerPersona.displayName,
      content: postContent,
      turn_number: 1,
    });

  conversationHistory.push({
    agentName: posterAgent.name,
    displayName: openerPersona.displayName,
    content: postContent,
  });

  for (let i = 0; i < shuffled.length; i++) {
    const responder = shuffled[i];
    const responderPersona = getPersonaForAgent(responder.name, null);

    const contextLines = conversationHistory
      .map(t => `${t.displayName} (${t.agentName}): ${t.content}`)
      .join("\n\n");

    const responderAngle = PERSONA_ANGLES[responder.name] || "Add something specific and new to the conversation.";

    let replyInstruction: string;
    if (postType === "breakthrough_idea") {
      replyInstruction = `You are responding to a breakthrough idea discussion. Your response must reflect your specific persona — not just generic commentary.

Your lens: ${responderAngle}

Rules:
- 2-3 sentences only. Every word earns its place.
- No bullet points, no headers.
- Add something the previous speakers have not said: a specific obstacle, a real-world parallel, a mechanism, a number, or a concrete extension.
- NEVER start with "I" — lead with the substance.
- Do not summarise what was already said. Move forward.`;
    } else if (postType === "industry_problem") {
      replyInstruction = `You are responding to an industry problem diagnosis. Your response must reflect your specific persona.

Your lens: ${responderAngle}

Rules:
- 2-3 sentences only.
- No bullet points, no headers.
- Either challenge the root cause, propose a better solution path, name a company already doing this well, or flag a second-order consequence.
- Ground it in something real: a number, a company, a mechanism, a policy.
- NEVER start with "I" — lead with the substance.`;
    } else {
      replyInstruction = `You are responding in a sharp professional debate. Your response must reflect your specific persona and add a distinct new angle.

Your lens: ${responderAngle}

Rules:
- 2-3 sentences only. Punchy.
- No bullet points, no headers.
- Either challenge a specific claim made above, extend the argument with new evidence, or introduce a dimension the conversation has missed.
- NEVER start with "I" — lead with the substance.
- Do not restate what was already said. Only add.`;
    }

    const replySystemPrompt = `${responderPersona.systemPrompt}

${replyInstruction}`;

    const replyUserMessage = `Topic: "${topic.title}"

Conversation so far:
${contextLines}

Respond as ${responder.name}. Say something they have not said yet.`;

    let replyContent: string;
    try {
      replyContent = await callOpenAI(replySystemPrompt, replyUserMessage, TOKEN_LIMITS.post_reply);
    } catch (_e) {
      replyContent = `That framing misses the deeper structural issue here — what we're actually seeing is a symptom of something that's been building for years.`;
    }

    await serviceSupabase
      .from("ai_agent_discussion_turns")
      .insert({
        discussion_id: discussion.id,
        agent_id: responder.id,
        agent_name: responder.name,
        display_name: responderPersona.displayName,
        content: replyContent,
        turn_number: i + 2,
      });

    conversationHistory.push({
      agentName: responder.name,
      displayName: responderPersona.displayName,
      content: replyContent,
    });

    await serviceSupabase
      .from("ai_agent_discussions")
      .update({ turn_count: i + 2 })
      .eq("id", discussion.id);
  }

  const allAgentNames = conversationHistory.map(t => t.agentName);
  const allDisplayNames = conversationHistory.map(t => t.displayName);

  let tlDr: string | null = null;
  let keyQuotes: { agent_name: string; display_name: string; quote: string }[] = [];
  try {
    const transcript = conversationHistory
      .map(t => `${t.displayName}: ${t.content}`)
      .join("\n\n");
    const summarySystem = `Summarise a short debate between AI advisor personas into ONE paragraph for a reader skimming the feed.

Rules:
- 2-4 sentences, max 60 words
- Lead with the single most important takeaway — no preamble, no listing agents
- Preserve any point of disagreement in one phrase
- Then return 3 sharp quotes, one per agent, each 1 sentence, verbatim or near-verbatim, each by a DIFFERENT agent
- Pick quotes that are the most contestable or highest-signal lines in the transcript

Return ONLY valid JSON:
{"tl_dr":"...","key_quotes":[{"agent_name":"...","display_name":"...","quote":"..."},{...},{...}]}`;

    const summaryUser = `TOPIC: ${topic.title}

TRANSCRIPT:
${transcript}`;

    const raw = await callOpenAI(summarySystem, summaryUser, 400, true);
    const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    if (parsed && typeof parsed.tl_dr === "string") {
      tlDr = parsed.tl_dr.trim();
    }
    if (parsed && Array.isArray(parsed.key_quotes)) {
      keyQuotes = parsed.key_quotes
        .filter((q: unknown): q is { agent_name: string; display_name: string; quote: string } => {
          return !!q && typeof q === "object"
            && typeof (q as { quote?: unknown }).quote === "string"
            && typeof (q as { display_name?: unknown }).display_name === "string";
        })
        .slice(0, 3)
        .map((q) => ({
          agent_name: q.agent_name || q.display_name,
          display_name: q.display_name,
          quote: q.quote.trim().slice(0, 240),
        }));
    }
  } catch (_e) {
    tlDr = null;
    keyQuotes = [];
  }

  await serviceSupabase
    .from("ai_agent_discussions")
    .update({
      discussion_status: "completed",
      completed_at: new Date().toISOString(),
      agent_ids: [posterAgent.id, ...shuffled.map(a => a.id)],
      agent_names: allAgentNames,
      agent_display_names: allDisplayNames,
      turn_count: conversationHistory.length,
      tl_dr: tlDr,
      key_quotes: keyQuotes.length > 0 ? keyQuotes : null,
      summary_generated_at: tlDr ? new Date().toISOString() : null,
    })
    .eq("id", discussion.id);

  return new Response(JSON.stringify({
    discussion,
    post,
    poster: posterAgent.name,
    display_name: persona.displayName,
    next_agent_index: nextIndex,
    turns: conversationHistory.length,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveAgentUserId(supabase: ReturnType<typeof createClient>, agentId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", "ai_agent_bot")
    .maybeSingle();
  if (profile) return profile.id;
  return null;
}
