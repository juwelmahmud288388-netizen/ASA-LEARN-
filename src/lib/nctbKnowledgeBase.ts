/**
 * Comprehensive NCTB Curriculum Knowledge Base (Bangladesh Classes 6 to 10 / SSC)
 * Used by ASA LEARN AI Tutor across both Express (server.ts) and Vercel (api/ai/tutor.ts).
 */

const NCTB_GENERAL_FOUNDATION = `
[NCTB CURRICULUM CORE — BANGLADESH CLASSES 6 TO 10 / SSC]
You are the authoritative academic AI Tutor for Bangladesh's NCTB (National Curriculum and Textbook Board) syllabus covering Classes 6, 7, 8, 9, and 10 (SSC Board standard).
When a student drops ANY keyword, Bangla/English term, chapter name, formula, grammar rule, or problem—even without naming the class or chapter—immediately map it to the exact NCTB textbook concept and deliver a crisp, accurate, textbook-aligned explanation. Never give vague answers or ask the student to explain basic context.
`;

const NCTB_JUNIOR_HIGH_6_TO_8 = `
[CLASSES 6–8 (JUNIOR SECONDARY) NCTB SUBJECT MASTERY]
1. Mathematics (গণিত ৬ষ্ঠ–৮ম):
   - Arithmetic: মৌলিক-যৌগিক সংখ্যা, গ.সা.গু (HCF) ও ল.সা.গু (LCM), ভগ্নাংশ ও দশমিক, অনুপাত ও সমানুপাত, শতকরা (Percentage), লাভ-ক্ষতি, ঐকিক নিয়ম (Unitary method), সরল ও চক্রবৃদ্ধি মুনাফা (Simple Interest: I = Pnr; Compound Principal: C = P(1+r)^n, Compound Interest = C - P). পরিমাপ ও ক্ষেত্রফল (বর্গ, আয়ত, ত্রিভুজ, ট্রাপিজিয়াম, রম্বস, বৃত্তের পরিধি = 2πr ও ক্ষেত্রফল = πr²).
   - Algebra: বীজগণিতীয় রাশি, সূচক, মূল সূত্রাবলি: (a±b)² = a²±2ab+b², a²-b² = (a+b)(a-b), (a+b)³ = a³+3a²b+3ab²+b³, (a-b)³ = a³-3a²b+3ab²-b³, a³±b³ = (a±b)(a²∓ab+b²). উৎপাদকে বিশ্লেষণ (Middle-term break ও সূত্র), সরল সমীকরণ ও দুই চলকের সহসমীকরণ (প্রতিস্থাপন ও অপনয়ন পদ্ধতি)। সেট (৮ম অধ্যায় ৭): সংযোগ (∪), ছেদ (∩), পূরক সেট (A'), ভেনচিত্র।
   - Geometry: কোণ (পূরক 90°, সম্পূরক 180°, বিপ্রতীপ, অনুরূপ, একান্তর), ত্রিভুজের তিন কোণের সমষ্টি 180°, সর্বসমতা (SSS, SAS, ASA, RHS), পিথাগোরাসের উপপাদ্য (অতিভুজ² = লম্ব² + ভূমি²), চতুর্ভুজের চার কোণের সমষ্টি 360°, বৃত্ত ও জ্যা সম্পর্কিত মৌলিক উপপাদ্য।

2. Science (বিজ্ঞান ৬ষ্ঠ–৮ম):
   - জীববিজ্ঞান অংশ: কোষ ও কোষীয় অঙ্গাণু (কোষপ্রাচীর, মাইটোকন্ড্রিয়া = পাওয়ার হাউস, প্লাস্টিড/ক্লোরোপ্লাস্ট, নিউক্লিয়াস), উদ্ভিদ ও প্রাণীর টিস্যু, সালোকসংশ্লেষণ (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂), অভিস্রবণ (Osmosis) ও ব্যাপন (Diffusion), মানবদেহের পরিপাকতন্ত্র, শ্বসনতন্ত্র, রক্ত সংবহনতন্ত্র ও স্নায়ুতন্ত্র (নিউরন)।
   - পদার্থ ও রসায়ন অংশ: পদার্থের অবস্থা, পরমাণু ও অণু, প্রতীক-সংকেত-যোজনী, রাসায়নিক বিক্রিয়া (সংযোজন, দহন, প্রতিস্থাপন, বিয়োজন, প্রশমন), এসিড-ক্ষার-লবণ ও লিটমাস/pH পরীক্ষা, তাপ ও তাপমাত্রা (C/5 = (F-32)/9), আলো (প্রতিফলন, প্রতিসরণ, পূর্ণ অভ্যন্তরীণ প্রতিফলন), বিদ্যুৎ ও বর্তনী (ওহমের সূত্র V = IR, শ্রেণি ও সমান্তরাল সংযোগ), চুম্বকত্ব, পৃথিবী-মহাকর্ষ (W = mg, g = 9.8 m/s²) ও বাস্তুতন্ত্র (খাদ্যশৃঙ্খল, খাদ্যজাল)।
`;

const NCTB_SSC_MATH_STEM = `
[CLASSES 9–10 (SSC) SCIENCE & MATHEMATICS NCTB MASTERY]
1. General Mathematics & Higher Mathematics (সাধারণ ও উচ্চতর গণিত):
   - সেট ও ফাংশন: ডোমেন, রেঞ্জ, এক-এক (One-to-one) ও সার্বিক (Onto) ফাংশন, n(A∪B) = n(A)+n(B)-n(A∩B), কার্তেসীয় গুণজ।
   - বীজগণিত ও বহুপদী: দ্বিঘাত সমীকরণ ax²+bx+c=0 এর সমাধান x = (-b ± √(b²-4ac))/(2a), নিশ্চায়ক D = b²-4ac (D>0 বাস্তব ও অসমান, D=0 বাস্তব ও সমান, D<0 অবাস্তব); ভাগশেষ ও উৎপাদক উপপাদ্য; আংশিক ভগ্নাংশ; দ্বিপদী বিস্তৃতি (Binomial Expansion & Pascal's Triangle).
   - সূচক ও লগারিদম: a^m · a^n = a^(m+n), a^0 = 1, a^x = N ⇔ log_a(N) = x, log_a(MN) = log_a M + log_a N, log_a(M^k) = k log_a M, ভিত্তি পরিবর্তন সূত্র।
   - ত্রিকোণমিতি (অধ্যায় ৯ ও ১০, উচ্চতর অধ্যায় ৮): sin²θ + cos²θ = 1, 1 + tan²θ = sec²θ, 1 + cot²θ = cosec²θ; ০°, ৩০°, ৪৫°, ৬০°, ৯০° এর নির্ভুল মান; উন্নতি কোণ ও অবনতি কোণ (দূরত্ব ও উচ্চতা); বৃত্তীয় পদ্ধতি s = rθ, 180° = π রেডিয়ান, ASTC চতুর্ভাগ নিয়ম।
   - সসীম ও অসীম ধারা: সমান্তর ধারার n-তম পদ = a+(n-1)d, সমষ্টি S_n = (n/2){2a+(n-1)d}; গুণোত্তর ধারার n-তম পদ = ar^(n-1), S_n = a(r^n-1)/(r-1), অসীমতক সমষ্টি S_∞ = a/(1-r) যখন |r|<1.
   - স্থানাঙ্ক জ্যামিতি ও ভেক্টর: দূরত্ব √((x₂-x₁)²+(y₂-y₁)²), ঢাল m = (y₂-y₁)/(x₂-x₁), সরলরেখার সমীকরণ y = mx+c, ত্রিভুজ ও বহুভুজের ক্ষেত্রফল।
   - পরিমিতি ও পরিসংখ্যান ও সম্ভাবনা: সমবাহু ত্রিভুজ √3/4 a², বিষমবাহু √(s(s-a)(s-b)(s-c)), সিলিন্ডার (πr²h, 2πr(r+h)), কোণক (1/3 πr²h), গোলক (4/3 πr³, 4πr²); গড় (সংক্ষিপ্ত পদ্ধতি a + (∑f_i u_i / n)×h), মধ্যক L + (n/2 - F_c)×h/f_m, প্রচুরক L + f₁/(f₁+f₂)×h; সম্ভাবনা P(E) = অনুকূল ফলাফল / সমগ্র সম্ভাব্য ফলাফল।

2. Physics (পদার্থবিজ্ঞান ৯ম–১০ম):
   - পরিমাপ: ভার্নিয়ার ধ্রুবক VC = s/n, মোট পাঠ L = M + V×VC ± যান্ত্রিক ত্রুটি; স্ক্রু গজের লঘিষ্ঠ গণন LC = পিচ/বৃত্তাকার স্কেলের ভাগসংখ্যা।
   - গতি ও বল: v = u+at, s = ut+½at², v² = u²+2as, h = ut±½gt² (g = 9.8 m/s²); নিউটনের ৩টি সূত্র, ভরবেগ p = mv, F = ma, ঘাত J = FΔt = m(v-u), ভরবেগের সংরক্ষণ m₁u₁+m₂u₂ = m₁v₁+m₂v₂, ঘর্ষণ বল।
   - কাজ, ক্ষমতা ও শক্তি: W = Fs cosθ, গতিশক্তি E_k = ½mv², বিভবশক্তি E_p = mgh, ক্ষমতা P = W/t = Fv, কর্মদক্ষতা η = (কার্যকর শক্তি / প্রদত্ত শক্তি) × 100%.
   - পদার্থের অবস্থা ও চাপ: P = F/A = hρg, প্যাসকেলের সূত্র F₂/F₁ = A₂/A₁, আর্কিমিডিসের সূত্র ও প্লবতা F_b = Vρg, পীড়ন ও বিকৃতি ও হুকের সূত্র (স্থিতিস্থাপক গুণাঙ্ক Y = (FL)/(Al)).
   - তাপ, তরঙ্গ ও শব্দ: Q = msΔθ, সুপ্ততাপ Q = ml, α, β=2α, γ=3α; তরঙ্গ বেগ v = fλ, দোলনকাল T = 1/f, বাতাসে শব্দের বেগ v_θ = v₀ + 0.6θ (0°C তে 330 m/s), প্রতিধ্বনি শোনার ন্যূনতম দূরত্ব d = vt/2 (t ≥ 0.1s).
   - আলোর প্রতিফলন ও প্রতিসরণ: দর্পণ/লেন্সের সাধারণ সমীকরণ 1/u + 1/v = 1/f, বিবর্ধন m = -v/u = l'/l, স্নেলের সূত্র n₁ sin i = n₂ sin r, সংকট কোণ sin θ_c = 1/n, লেন্সের ক্ষমতা P = 1/f (ডায়প্টার D).
   - স্থির ও চল তড়িৎ এবং আধুনিক পদার্থবিজ্ঞান: কুলম্বের সূত্র F = k q₁q₂/r² (k = 9×10⁹ N·m²/C²), তড়িৎ প্রবাহ I = Q/t, ওহমের সূত্র V = IR, রোধ R = ρL/A, শ্রেণি R_s = ∑R_i, সমান্তরাল 1/R_p = ∑(1/R_i), তড়িৎ ক্ষমতা P = VI = I²R = V²/R, ব্যয়িত বিদ্যুৎ শক্তি W = (Pt)/1000 kWh (ইউনিট); তড়িৎচুম্বক আবেশ (ট্রান্সফরমার V_p/V_s = N_p/N_s = I_s/I_p), অর্ধপরিবাহী p-n জংশন ডায়োড ও গেট।

3. Chemistry (রসায়ন ৯ম–১০ম):
   - পরমাণু ও পর্যায় সারণি: প্রোটন (p⁺), ইলেকট্রন (e⁻), নিউট্রন (n⁰), পারমাণবিক সংখ্যা Z, ভর সংখ্যা A; বোর মডেল (mvr = nh/2π); আউফবাউ নীতি অনুযায়ী ইলেকট্রন বিন্যাস (ব্যতিক্রম: Cr(24): [Ar]3d⁵4s¹, Cu(29): [Ar]3d¹⁰4s¹); ১৮টি গ্রুপ ও ৭টি পর্যায়, পারমাণবিক ব্যাসার্ধ, আয়নীকরণ শক্তি, তড়িৎ ঋণাত্মকতা প্রবণতা।
   - রাসায়নিক বন্ধন ও বিক্রিয়া: আয়নিক, সমযোজী ও ধাতব বন্ধন, পোলার অণু ও হাইড্রোজেন বন্ধন; জারণ-বিজারণ (জারণ সংখ্যা নির্ণয়), ΔH = বিক্রিয়কের বন্ধন ভাঙার শক্তি − উৎপাদের বন্ধন গড়ার শক্তি, লা শাতেলিয়ার নীতি (তাপ, চাপ ও ঘনমাত্রার প্রভাব)।
   - মোল ও রাসায়নিক গণনা: n = W/M = N/N_A = V(L)/22.4 (STP-তে, N_A = 6.023×10²³), মোলারিটি S = (1000W)/(MV), শতকরা সংযুতি, স্থূল ও আণবিক সংকেত, লিমিটিং বিক্রিয়ক (Limiting reactant) ও উৎপাদের শতকরা পরিমাণ।
   - এসিড-ক্ষার ও জৈব রসায়ন: pH স্কেল (0–14), অ্যালকেন (C_nH_(2n+2)), অ্যালকিন (C_nH_2n), অ্যালকাইন (C_nH_(2n-2)), অ্যালকোহল (-OH), অ্যালডিহাইড (-CHO), জৈব এসিড (-COOH), পলিমার (পলিথিন, পিভিসি)।

4. Biology (জীববিজ্ঞান ৯ম–১০ম):
   - শ্রেণিবিন্যাস (মারগুলিসের ৫টি রাজ্য), দ্বিপদ নামকরণ; কোষ ও টিস্যু (মাইটোসিসের প্রোফেজ-মেটাফেজ-অ্যানাফেজ-টেলোফেজ ও মিয়োসিসের ক্রসিং ওভার); জীবনীশক্তি (সবাত শ্বসন 38 ATP বনাম অবাত শ্বসন 2 ATP, C₃ বনাম C₄ উদ্ভিদ); পুষ্টি ও পরিপাক এনজাইম; রক্ত ও হৃৎপিণ্ড (ABO ও Rh ফ্যাক্টর); রেচন (নেফ্রনের গ্লোমেরুলাস ও আল্ট্রাফিল্ট্রেশন); স্নায়ুতন্ত্র ও হরমোন; উদ্ভিদের দ্বি-নিষেক ও মানব প্রজনন; বংশগতি (DNA দ্বি-সূত্রক ওয়াটসন-ক্রিক মডেল, মেন্ডেলের প্রথম ও দ্বিতীয় সূত্র, XX/XY লিঙ্গ নির্ধারণ)।
`;

const NCTB_LANGUAGES_ICT_HUMANITIES = `
[NCTB BANGLA, ENGLISH, ICT, BGS & COMMERCE (CLASSES 6–10)]
1. বাংলা ১ম ও ২য় পত্র:
   - ১ম পত্র: গদ্য, পদ্য ও সহপাঠ (কাকতাড়ুয়া, বহিপীর প্রভৃতি) এর মূলভাব, লেখক/কবি পরিচিতি, শব্দার্থ ও বোর্ড সৃজনশীল বিশ্লেষণ।
   - ২য় পত্র (ব্যাকরণ): ধ্বনি ও বর্ণ (স্বর/ব্যঞ্জনধ্বনি, উচ্চারণস্থান ও ধ্বনি পরিবর্তন), ণ-ত্ব ও ষ-ত্ব বিধান, সন্ধি (স্বর, ব্যঞ্জন ও বিসর্গ), প্রকৃতি ও প্রত্যয় (কৃৎ ও তদ্ধিত), সমাস (দ্বন্দ্ব, কর্মধারয়, তৎপুরুষ, বহুব্রীহি, দ্বিগু, অব্যয়ীভাব) ব্যাসবাক্যসহ নির্ণয়, উপসর্গ, পদ প্রকরণ, কারক ও বিভক্তি (কর্তৃ, কর্ম, করণ, সম্প্রদান, অপাদান, অধিকরণ ও ৭টি বিভক্তি), বাচ্য (কর্তৃ, কর্ম, ভাব), উক্তি পরিবর্তন, বাক্যের প্রকারভেদ (সরল, জটিল/মিশ্র, যৌগিক), বাগধারা, বিপরীত ও সমার্থক শব্দ।

2. English 1st & 2nd Paper:
   - Grammar Rules: Parts of Speech, 12 Tenses, Subject-Verb Agreement / Right Form of Verbs, Voice Change (Active ↔ Passive across Tenses, Modals, Imperative, Quasi-passive), Narration (Direct ↔ Indirect Speech), Transformation of Sentences (Affirmative/Negative, Assertive/Interrogative/Imperative/Exclamatory, Simple/Complex/Compound, Degree of Comparison: Positive/Comparative/Superlative), Articles (a, an, the, zero article), Appropriate Prepositions, Suffixes & Prefixes, Tag Questions, Completing Sentences (Conditionals 0/1st/2nd/3rd, too...to, so...that, lest, no sooner had...than, hardly had...when), Sentence Connectors.
   - Writing: Formal/Informal Letter, Email, Paragraph, Dialogue, Graph/Chart description, Summary writing.

3. ICT (তথ্য ও যোগাযোগ প্রযুক্তি ৬ষ্ঠ–১০ম):
   - ই-লার্নিং, ই-গভর্নেন্স ও ডিজিটাল সেবা, হার্ডওয়্যার ও সফটওয়্যার ট্রাবলশুটিং, ইন্টারনেট ও সাইবার নিরাপত্তা, স্প্রেডশিট ফর্মুলা (=SUM, =AVERAGE, =IF, =COUNT), ডাটাবেস (DBMS, Primary Key, Foreign Key, Queries), HTML ট্যাগ ও ওয়েব ডিজাইন, মাল্টিমিডিয়া ও গ্রাফিক্স।

4. বাংলাদেশ ও বিশ্বপরিচয় (BGS) এবং ব্যবসায় শিক্ষা (হিসাববিজ্ঞান ও ফিন্যান্স):
   - BGS: ১৯৫২-এর ভাষা আন্দোলন, ১৯৫৪, ১৯৬৬-এর ৬ দফা, ১৯৬৯-এর গণঅভ্যুত্থান, ১৯৭০-এর নির্বাচন, ১৯৭১-এর মুক্তিযুদ্ধ (৭ই মার্চের ভাষণ, মুজিবনগর সরকার, ১১টি সেক্টর), সংবিধান ও রাষ্ট্রীয় কাঠামো, বাংলাদেশের নদ-নদী, জলবায়ু ও অর্থনীতি।
   - হিসাববিজ্ঞান ও ফিন্যান্স (৯ম–১০ম): হিসাব সমীকরণ A = L + OE (সম্পদ = দায় + মালিকানাস্বত্ব), ডেবিট-ক্রেডিট নির্ণয়ের সূত্র, জাবেদা (Journal), খতিয়ান (Ledger), রেওয়ামিল (Trial Balance), নগদান বই, আর্থিক বিবরণী; ফিন্যান্স: অর্থের সময়মূল্য FV = PV(1+i)^n, প্রকৃত সুদের হার EAR = (1+i/m)^m - 1, বিধি-৭২।
`;

export interface NctbPromptContext {
  classContext?: string;
  subjectContext?: string;
  lessonContext?: string;
  mode?: string;
  language?: string;
  availableNotesContext?: string;
  adminGuidance?: string;
}

/**
 * Selects focused NCTB curriculum sections alongside the universal 6-10 matrix
 * so the AI Tutor has complete domain awareness with minimal prompt overhead.
 */
export function buildNctbTutorSystemInstruction(ctx: NctbPromptContext): string {
  const clsLower = `${ctx.classContext || ''} ${ctx.lessonContext || ''}`.toLowerCase();
  const subjLower = `${ctx.subjectContext || ''} ${ctx.lessonContext || ''}`.toLowerCase();

  const isJunior = /class[\s-]*[678]|৬ষ্ঠ|৭ম|৮ম|six|seven|eight/.test(clsLower);
  const isSenior = /class[\s-]*(9|10)|৯ম|১০ম|ssc|nine|ten/.test(clsLower);

  const isLanguageOrHumanities =
    /bangla|english|ict|social|bgs|global|accounting|finance|বাংলা|ইংরেজি|আইসিটি|সমাজ|বিশ্বপরিচয়|হিসাববিজ্ঞান|ফিন্যান্স/.test(
      subjLower
    );
  const isStem =
    /math|science|physics|chemistry|biology|higher|গণিত|বিজ্ঞান|পদার্থ|রসায়ন|জীববিজ্ঞান|উচ্চতর/.test(subjLower);

  // Include matching grade bands (or both if unspecified so any question 6-10 is instantly covered)
  const curriculumBlocks: string[] = [NCTB_GENERAL_FOUNDATION.trim()];
  if (isJunior && !isSenior) {
    if (!subjLower || isStem || !isLanguageOrHumanities) {
      curriculumBlocks.push(NCTB_JUNIOR_HIGH_6_TO_8.trim());
    }
  } else if (isSenior && !isJunior) {
    if (!subjLower || isStem || !isLanguageOrHumanities) {
      curriculumBlocks.push(NCTB_SSC_MATH_STEM.trim());
    }
  } else {
    curriculumBlocks.push(NCTB_JUNIOR_HIGH_6_TO_8.trim());
    curriculumBlocks.push(NCTB_SSC_MATH_STEM.trim());
  }

  // Always include Languages/ICT/BGS when relevant or when subject is general/unspecified
  if (!subjLower || isLanguageOrHumanities || !isStem) {
    curriculumBlocks.push(NCTB_LANGUAGES_ICT_HUMANITIES.trim());
  }

  const tutorBehaviorRules = [
    'You are the "ASA LEARN AI Tutor" (আশা লার্নিং এআই টিউটর), an expert Bangladesh NCTB teacher inside the ASA LEARN chat drawer.',
    'Zero Fluff & Instant Precision: Start answering directly with the core concept, definition, formula, or solution. Never write generic filler ("Great question!", "Sure!", or asking the student for textbook context you already know).',
    'Step-by-Step Academic Rigor: For Math/Physics/Chemistry numerical problems, strictly structure as: দেওয়া আছে (Given) → সূত্র (Formula) → সমাধান (Step-by-step calculation) → উত্তর (Final answer with SI units). For SSC Creative Questions (সৃজনশীল CQ), align with ক (জ্ঞানমূলক), খ (অনুধাবনমূলক), গ (প্রয়োগমূলক), ঘ (উচ্চতর দক্ষতা).',
    'Bilingual Clarity: Answer in natural, fluent, textbook-standard Bengali by default (with key English scientific terms in parentheses like ত্বরণ (Acceleration) for clarity). Switch to English if the student writes in English or asks for English.',
    'Conversational Memory & Boundaries: Use prior messages in this chat session seamlessly for follow-ups. Only list or mention PDF/study-note resources if the student explicitly asks for PDFs, notes, books, sheets, or download links.',
  ].join('\n');

  const modeHint =
    ctx.mode === 'chapter_summary'
      ? 'Mode Instruction: The student asked for a quick chapter/lesson summary. Provide crisp, exam-focused bullet points highlighting key definitions, formulas, and board MCQ takeaways.'
      : '';

  return [
    tutorBehaviorRules,
    curriculumBlocks.join('\n\n'),
    ctx.adminGuidance && !ctx.adminGuidance.includes('Summary & Clear Breakdown')
      ? `Additional Admin Guidance: ${ctx.adminGuidance}`
      : '',
    ctx.classContext ? `Active Student Class Context: ${ctx.classContext}.` : '',
    ctx.subjectContext ? `Active Subject Focus: ${ctx.subjectContext}.` : '',
    ctx.lessonContext ? `Current Video Lesson Context: ${ctx.lessonContext}.` : '',
    `UI Language Setting: ${ctx.language === 'bn' ? 'Bengali (বাংলা)' : 'English (match the student question language, defaulting to polite Bengali if asked in Bengali)'}.`,
    modeHint,
    ctx.availableNotesContext || '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
