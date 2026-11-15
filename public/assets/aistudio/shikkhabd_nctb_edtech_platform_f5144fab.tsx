import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen, GraduationCap, Play, Sparkles, Shield, ChevronRight,
  ArrowLeft, CheckCircle2, Clock, Youtube, Plus, Trash2, Search,
  Send, X, Bot, User, Layers, Zap, Award, Compass, Calculator,
  FlaskConical, Atom, Dna, Globe, Languages, Cpu, Landmark,
  TrendingUp, Briefcase, Scale, Sprout, Moon, Sun, Lock, Unlock,
  FolderPlus, Video, FileText, RotateCcw, AlertCircle, Check
} from 'lucide-react';

// ============================================================================
// 1. NCTB CURRICULUM SCHEMA & SUBJECT CATALOG (CLASS 6 - 10)
// ============================================================================

const CLASSES = [
  { id: '6', label: 'Class 6', bn: 'ষষ্ঠ শ্রেণি', badge: 'Junior Secondary', color: 'from-emerald-500 to-teal-600', lightBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { id: '7', label: 'Class 7', bn: 'সপ্তম শ্রেণি', badge: 'Junior Secondary', color: 'from-teal-500 to-cyan-600', lightBg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { id: '8', label: 'Class 8', bn: 'অষ্টম শ্রেণি', badge: 'Junior Board Prep', color: 'from-sky-500 to-blue-600', lightBg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { id: '9', label: 'Class 9', bn: 'নবম শ্রেণি', badge: 'SSC Foundation', color: 'from-indigo-500 to-violet-600', lightBg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { id: '10', label: 'Class 10', bn: 'দশম শ্রেণি', badge: 'SSC Candidate', color: 'from-violet-600 to-purple-700', lightBg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
];

const GROUPS = [
  {
    id: 'science',
    label: 'Science',
    bn: 'বিজ্ঞান বিভাগ',
    desc: 'Physics, Chemistry, Biology, Higher Math & Core Subjects',
    icon: Atom,
    gradient: 'from-indigo-600 to-blue-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  {
    id: 'arts',
    label: 'Arts / Humanities',
    bn: 'মানবিক বিভাগ',
    desc: 'History, Geography, Civics, Economics & Core Subjects',
    icon: Landmark,
    gradient: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    id: 'commerce',
    label: 'Commerce / Business',
    bn: 'ব্যবসায় শিক্ষা বিভাগ',
    desc: 'Accounting, Finance & Banking, Entrepreneurship & Core',
    icon: TrendingUp,
    gradient: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
  }
];

const JUNIOR_SUBJECTS = [
  { id: 'bangla-1', name: 'Bangla 1st Paper', bn: 'বাংলা ১ম পত্র', icon: BookOpen, color: 'bg-emerald-100 text-emerald-700' },
  { id: 'bangla-2', name: 'Bangla 2nd Paper', bn: 'বাংলা ২য় পত্র', icon: Languages, color: 'bg-teal-100 text-teal-700' },
  { id: 'english-1', name: 'English 1st Paper', bn: 'ইংরেজি ১ম পত্র', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  { id: 'english-2', name: 'English 2nd Paper', bn: 'ইংরেজি ২য় পত্র', icon: FileText, color: 'bg-sky-100 text-sky-700' },
  { id: 'math', name: 'Mathematics', bn: 'গণিত', icon: Calculator, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'science', name: 'General Science', bn: 'সাধারণ বিজ্ঞান', icon: FlaskConical, color: 'bg-purple-100 text-purple-700' },
  { id: 'ict', name: 'ICT', bn: 'তথ্য ও যোগাযোগ প্রযুক্তি', icon: Cpu, color: 'bg-cyan-100 text-cyan-700' },
  { id: 'bgs', name: 'Bangladesh & Global Studies', bn: 'বাংলাদেশ ও বিশ্বপরিচয়', icon: Compass, color: 'bg-amber-100 text-amber-700' },
  { id: 'islam', name: 'Islam & Moral Education', bn: 'ইসলাম ও নৈতিক শিক্ষা', icon: Moon, color: 'bg-green-100 text-green-700' },
  { id: 'hindu', name: 'Hindu Religion & Moral Ed.', bn: 'হিন্দুধর্ম ও নৈতিক শিক্ষা', icon: Sun, color: 'bg-orange-100 text-orange-700' },
  { id: 'agri', name: 'Agriculture Studies', bn: 'কৃষিশিক্ষা', icon: Sprout, color: 'bg-lime-100 text-lime-700' },
];

const SSC_COMMON_SUBJECTS = [
  { id: 'bangla-1', name: 'Bangla 1st Paper', bn: 'বাংলা ১ম পত্র', icon: BookOpen, color: 'bg-emerald-100 text-emerald-700' },
  { id: 'bangla-2', name: 'Bangla 2nd Paper', bn: 'বাংলা ২য় পত্র', icon: Languages, color: 'bg-teal-100 text-teal-700' },
  { id: 'english-1', name: 'English 1st Paper', bn: 'ইংরেজি ১ম পত্র', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  { id: 'english-2', name: 'English 2nd Paper', bn: 'ইংরেজি ২য় পত্র', icon: FileText, color: 'bg-sky-100 text-sky-700' },
  { id: 'math', name: 'General Mathematics', bn: 'সাধারণ গণিত', icon: Calculator, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'ict', name: 'ICT', bn: 'তথ্য ও যোগাযোগ প্রযুক্তি', icon: Cpu, color: 'bg-cyan-100 text-cyan-700' },
  { id: 'islam', name: 'Islam & Moral Education', bn: 'ইসলাম ও নৈতিক শিক্ষা', icon: Moon, color: 'bg-green-100 text-green-700' },
  { id: 'hindu', name: 'Hindu Religion & Moral Ed.', bn: 'হিন্দুধর্ম ও নৈতিক শিক্ষা', icon: Sun, color: 'bg-orange-100 text-orange-700' },
];

const SSC_GROUP_SUBJECTS = {
  science: [
    { id: 'physics', name: 'Physics', bn: 'পদার্থবিজ্ঞান', icon: Atom, color: 'bg-violet-100 text-violet-700' },
    { id: 'chemistry', name: 'Chemistry', bn: 'রসায়ন', icon: FlaskConical, color: 'bg-rose-100 text-rose-700' },
    { id: 'biology', name: 'Biology', bn: 'জীববিজ্ঞান', icon: Dna, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'higher-math', name: 'Higher Mathematics', bn: 'উচ্চতর গণিত', icon: Calculator, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'bgs', name: 'Bangladesh & Global Studies', bn: 'বাংলাদেশ ও বিশ্বপরিচয়', icon: Compass, color: 'bg-amber-100 text-amber-700' },
    ...SSC_COMMON_SUBJECTS,
  ],
  arts: [
    { id: 'history', name: 'History of Bangladesh & World', bn: 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', icon: Landmark, color: 'bg-amber-100 text-amber-700' },
    { id: 'geography', name: 'Geography & Environment', bn: 'ভূগোল ও পরিবেশ', icon: Globe, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'civics', name: 'Civics & Citizenship', bn: 'পৌরনীতি ও নাগরিকতা', icon: Scale, color: 'bg-blue-100 text-blue-700' },
    { id: 'economics', name: 'Economics', bn: 'অর্থনীতি', icon: TrendingUp, color: 'bg-purple-100 text-purple-700' },
    { id: 'science', name: 'General Science', bn: 'সাধারণ বিজ্ঞান', icon: FlaskConical, color: 'bg-teal-100 text-teal-700' },
    ...SSC_COMMON_SUBJECTS,
  ],
  commerce: [
    { id: 'accounting', name: 'Accounting', bn: 'হিসাববিজ্ঞান', icon: Calculator, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'finance', name: 'Finance & Banking', bn: 'ফিন্যান্স ও ব্যাংকিং', icon: TrendingUp, color: 'bg-indigo-100 text-indigo-700' },
    { id: 'business-ent', name: 'Business Entrepreneurship', bn: 'ব্যবসায় উদ্যোগ', icon: Briefcase, color: 'bg-amber-100 text-amber-700' },
    { id: 'science', name: 'General Science', bn: 'সাধারণ বিজ্ঞান', icon: FlaskConical, color: 'bg-teal-100 text-teal-700' },
    ...SSC_COMMON_SUBJECTS,
  ]
};

function getSubjectsForSelection(classId, groupId) {
  if (['6', '7', '8'].includes(classId)) {
    return JUNIOR_SUBJECTS;
  }
  return SSC_GROUP_SUBJECTS[groupId] || SSC_GROUP_SUBJECTS.science;
}

// ============================================================================
// 2. INITIAL REALISTIC NCTB CHAPTERS & PRE-LOADED YOUTUBE LESSONS
// ============================================================================

const INITIAL_CURRICULUM_DATA = {
  // Class 9 & 10 Science - Physics
  '9_science_physics': {
    basicToPro: [
      {
        id: 'ch-phy-1',
        number: 'Chapter 01',
        title: 'Physical Quantities and Measurement (ভৌত রাশি ও পরিমাপ)',
        videos: [
          {
            id: 'v-phy-101',
            youtubeId: 'b1t41Q3xRM8',
            title: 'Physics Basics: Units, Dimensions & Vernier Scale',
            duration: '24:15',
            notes: 'Understand fundamental vs derived quantities, SI units, Vernier constant calculation, and screw gauge least count for SSC board exams.'
          },
          {
            id: 'v-phy-102',
            youtubeId: 'ZM8ECpBuQYE',
            title: '1D Motion & Measurement Foundations',
            duration: '18:40',
            notes: 'Key formulas for displacement, velocity, acceleration, and error percentage calculations in lab experiments.'
          }
        ]
      },
      {
        id: 'ch-phy-2',
        number: 'Chapter 02',
        title: 'Motion (গতি)',
        videos: [
          {
            id: 'v-phy-201',
            youtubeId: 'ZM8ECpBuQYE',
            title: 'Equations of Motion & Falling Bodies Explained',
            duration: '32:10',
            notes: 'Complete breakdown of v = u + at, s = ut + ½at², v² = u² + 2as, and Galileo’s laws of falling bodies with board math solutions.'
          }
        ]
      },
      {
        id: 'ch-phy-3',
        number: 'Chapter 03',
        title: 'Force (বল)',
        videos: [
          {
            id: 'v-phy-301',
            youtubeId: 'kKKM8Y-u7ds',
            title: 'Newton’s Laws of Motion & Conservation of Momentum',
            duration: '28:50',
            notes: 'Inertia, F = ma, action-reaction pairs, recoil velocity of a gun, and friction math problems.'
          }
        ]
      },
      {
        id: 'ch-phy-4',
        number: 'Chapter 04',
        title: 'Work, Power and Energy (কাজ, ক্ষমতা ও শক্তি)',
        videos: [
          {
            id: 'v-phy-401',
            youtubeId: 'w4QFJb9a8vo',
            title: 'Kinetic Energy, Potential Energy & Efficiency',
            duration: '26:12',
            notes: 'Conservation of mechanical energy at different heights, motor efficiency problems, and kilowatt-hour conversions.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-phy-1',
        youtubeId: 'b1t41Q3xRM8',
        title: 'SSC Physics Full Mechanics Crash Revision (Ch 1–4) | Exam Night Special',
        duration: '1:15:00',
        tag: 'Full Mechanics One-Shot',
        notes: 'Rapid formula sheet walkthrough + top 15 Creative Questions (সৃজনশীল) solved for tomorrow’s exam.'
      },
      {
        id: 'os-phy-2',
        youtubeId: 'kKKM8Y-u7ds',
        title: 'All Physics Formulas & Board MCQ Masterclass in 45 Minutes',
        duration: '45:20',
        tag: 'MCQ + Formula Express',
        notes: 'Every single formula from NCTB Physics textbook organized chapter-by-chapter with unit shortcuts.'
      }
    ]
  },

  // Class 10 Science - Physics (mirrors rich SSC content)
  '10_science_physics': {
    basicToPro: [
      {
        id: 'ch-10-phy-2',
        number: 'Chapter 02',
        title: 'Motion (গতি)',
        videos: [
          {
            id: 'v-10-phy-201',
            youtubeId: 'ZM8ECpBuQYE',
            title: 'SSC Motion: Graph Analysis & Board Creative Questions',
            duration: '29:45',
            notes: 'Velocity-time graphs, distance covered in nth second, and train-car overtaking math.'
          }
        ]
      },
      {
        id: 'ch-10-phy-3',
        number: 'Chapter 03',
        title: 'Force (বল)',
        videos: [
          {
            id: 'v-10-phy-301',
            youtubeId: 'kKKM8Y-u7ds',
            title: 'Newton’s Laws, Momentum & Collisions',
            duration: '27:10',
            notes: 'Elastic vs inelastic collisions and board CQ shortcuts.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-10-phy-1',
        youtubeId: 'b1t41Q3xRM8',
        title: 'SSC 2026 Physics Final Revision: Must-Do Chapters & Board CQs',
        duration: '1:20:00',
        tag: 'SSC Final Revision',
        notes: 'Complete exam-night blueprint covering Motion, Force, Work-Energy, Reflection & Current Electricity.'
      }
    ]
  },

  // Class 9 & 10 General Mathematics
  '9_science_math': {
    basicToPro: [
      {
        id: 'ch-math-1',
        number: 'Chapter 01',
        title: 'Real Numbers (বাস্তব সংখ্যা)',
        videos: [
          {
            id: 'v-math-101',
            youtubeId: '5PcpBw5Hbwo',
            title: 'Classification of Real Numbers, Rational vs Irrational Proofs',
            duration: '22:30',
            notes: 'How to prove √2, √3, √5 are irrational numbers (guaranteed Board CQ!), plus recurring decimal conversions.'
          }
        ]
      },
      {
        id: 'ch-math-2',
        number: 'Chapter 02',
        title: 'Set and Function (সেট ও ফাংশন)',
        videos: [
          {
            id: 'v-math-201',
            youtubeId: 'tyDKR4FG3Yw',
            title: 'Roster & Set Builder Method, Power Sets & Venn Diagrams',
            duration: '25:40',
            notes: 'Proving n(P(A)) = 2^n, Cartesian product, domain & range of functions.'
          }
        ]
      },
      {
        id: 'ch-math-3',
        number: 'Chapter 03',
        title: 'Algebraic Expressions (বীজগাণিতিক রাশি)',
        videos: [
          {
            id: 'v-math-301',
            youtubeId: 'NybHckSEQBI',
            title: 'Square & Cube Formulas, Factorization & Remainder Theorem',
            duration: '31:15',
            notes: 'Mastering x + 1/x type board creative problems and algebraic identities.'
          }
        ]
      },
      {
        id: 'ch-math-9',
        number: 'Chapter 09',
        title: 'Trigonometric Ratio (ত্রিকোণমিতিক অনুপাত)',
        videos: [
          {
            id: 'v-math-901',
            youtubeId: 'PUB0TaZ7bhA',
            title: 'Trigonometry Ratios, Identities & Angle Values Made Easy',
            duration: '34:00',
            notes: 'sin²θ + cos²θ = 1, sec²θ - tan²θ = 1, and hand-trick for 0°, 30°, 45°, 60°, 90°.'
          }
        ]
      },
      {
        id: 'ch-math-17',
        number: 'Chapter 17',
        title: 'Statistics (পরিসংখ্যান)',
        videos: [
          {
            id: 'v-math-1701',
            youtubeId: 'uhxtUt_-GyM',
            title: 'Mean, Median, Mode & Ogive Curve (10 Marks Guaranteed)',
            duration: '28:20',
            notes: 'Step-by-step grouped frequency table, shortcut mean, histogram, frequency polygon, and ogive.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-math-1',
        youtubeId: 'PUB0TaZ7bhA',
        title: 'Trigonometry + Statistics Full Exam Night Crash Course (20 Marks)',
        duration: '58:10',
        tag: 'High-Yield 20 Marks',
        notes: 'Guaranteed 2 Creative Questions in SSC General Math covered in under 1 hour.'
      }
    ]
  },

  // Class 9 Science - Chemistry
  '9_science_chemistry': {
    basicToPro: [
      {
        id: 'ch-chem-3',
        number: 'Chapter 03',
        title: 'Structure of Matter (পদার্থের গঠন)',
        videos: [
          {
            id: 'v-chem-301',
            youtubeId: 'FSyAehMdpyI',
            title: 'Atomic Models, Isotopes & Electronic Configuration',
            duration: '26:45',
            notes: 'Rutherford & Bohr atomic models, calculating relative atomic mass from isotope percentages.'
          }
        ]
      },
      {
        id: 'ch-chem-4',
        number: 'Chapter 04',
        title: 'Periodic Table (পর্যায় সারণি)',
        videos: [
          {
            id: 'v-chem-401',
            youtubeId: '0RRVV4Diomg',
            title: 'Determining Group & Period + Periodic Trends',
            duration: '24:10',
            notes: 'Atomic radius, ionization energy, electronegativity across periods and groups.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-chem-1',
        youtubeId: '0RRVV4Diomg',
        title: 'Chemistry Ch 3, 4 & 5 Complete Concept Map One-Shot',
        duration: '52:00',
        tag: 'Exam Night Express',
        notes: 'Chemical bonding (ionic, covalent, metallic) + periodic table exceptions in one video.'
      }
    ]
  },

  // Class 8 Mathematics
  '8_general_math': {
    basicToPro: [
      {
        id: 'ch-8-math-1',
        number: 'Chapter 01',
        title: 'Patterns (প্যাটার্ন)',
        videos: [
          {
            id: 'v-8-math-101',
            youtubeId: '5PcpBw5Hbwo',
            title: 'Number Patterns, Magic Squares & Algebraic Expressions',
            duration: '21:15',
            notes: 'Finding the nth term of a sequence and constructing 3x3 & 4x4 magic squares.'
          }
        ]
      },
      {
        id: 'ch-8-math-4',
        number: 'Chapter 04',
        title: 'Algebraic Formulae & Applications (বীজগণিতীয় সূত্রাবলি ও প্রয়োগ)',
        videos: [
          {
            id: 'v-8-math-401',
            youtubeId: 'NybHckSEQBI',
            title: 'Class 8 Algebra: Squares, Cubes & Middle-Term Factorization',
            duration: '27:30',
            notes: 'Core formulas (a+b)², (a-b)², a²-b² and solving word problems easily.'
          }
        ]
      },
      {
        id: 'ch-8-math-9',
        number: 'Chapter 09',
        title: 'Pythagoras Theorem (পিথাগোরাসের উপপাদ্য)',
        videos: [
          {
            id: 'v-8-math-901',
            youtubeId: 'AA6RfgP-AHU',
            title: 'Proof & Applications of Pythagoras Theorem',
            duration: '19:45',
            notes: 'Visual proof of a² + b² = c² for right-angled triangles and geometry exercises.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-8-math-1',
        youtubeId: 'AA6RfgP-AHU',
        title: 'Class 8 Math Full Geometry & Algebra Revision Night',
        duration: '48:00',
        tag: 'Exam Night Special',
        notes: 'All important theorems and algebraic formulas revised step by step.'
      }
    ]
  },

  // Class 6 Mathematics
  '6_general_math': {
    basicToPro: [
      {
        id: 'ch-6-math-1',
        number: 'Chapter 01',
        title: 'Story of Numbers (সংখ্যার গল্প)',
        videos: [
          {
            id: 'v-6-math-101',
            youtubeId: '5PcpBw5Hbwo',
            title: 'Place Value, Deshi & International Number Systems',
            duration: '16:20',
            notes: 'Understanding Lakh, Crore vs Million, Billion with fun real-life examples.'
          }
        ]
      },
      {
        id: 'ch-6-math-2',
        number: 'Chapter 02',
        title: 'Fractions & Decimals (ভগ্নাংশ ও দশমিক)',
        videos: [
          {
            id: 'v-6-math-201',
            youtubeId: 'NybHckSEQBI',
            title: 'Adding, Subtracting & Multiplying Fractions Made Super Easy',
            duration: '19:10',
            notes: 'LCM method for fractions and converting fractions into percentages.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-6-math-1',
        youtubeId: '5PcpBw5Hbwo',
        title: 'Class 6 Complete Math Quick Revision Before Exam',
        duration: '35:00',
        tag: 'Kid-Friendly Recap',
        notes: 'Simple, step-by-step recap of numbers, fractions, and basic geometry.'
      }
    ]
  },

  // Class 7 General Science
  '7_general_science': {
    basicToPro: [
      {
        id: 'ch-7-sci-1',
        number: 'Chapter 01',
        title: 'Diversity of Living Organisms (জীবের শ্রেণিবিন্যাস)',
        videos: [
          {
            id: 'v-7-sci-101',
            youtubeId: 'FSyAehMdpyI',
            title: 'Five Kingdoms of Living Things Explained Visually',
            duration: '18:05',
            notes: 'Monera, Protista, Fungi, Plantae, and Animalia characteristics with examples.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-7-sci-1',
        youtubeId: 'FSyAehMdpyI',
        title: 'Class 7 Science Exam Night Rapid Summary',
        duration: '40:15',
        tag: 'Full Book Recap',
        notes: 'Key definitions, diagrams, and short questions for Class 7 Science.'
      }
    ]
  },

  // Class 9 Commerce - Accounting
  '9_commerce_accounting': {
    basicToPro: [
      {
        id: 'ch-acc-1',
        number: 'Chapter 01',
        title: 'Introduction to Accounting (হিসাববিজ্ঞান পরিচিতি)',
        videos: [
          {
            id: 'v-acc-101',
            youtubeId: 'yYX4bvQSqbo',
            title: 'Accounting Equation (A = L + E) & Golden Rules of Debit/Credit',
            duration: '25:00',
            notes: 'Assets = Liabilities + Owner’s Equity explained with Bangladeshi business transactions.'
          }
        ]
      },
      {
        id: 'ch-acc-2',
        number: 'Chapter 02',
        title: 'Transactions & Journal (লেনদেন ও জাবেদা)',
        videos: [
          {
            id: 'v-acc-201',
            youtubeId: 'yYX4bvQSqbo',
            title: 'How to Pass General Journal Entries Without Mistakes',
            duration: '29:30',
            notes: 'Identifying events vs transactions and preparing tabular accounting equation statements.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: 'os-acc-1',
        youtubeId: 'yYX4bvQSqbo',
        title: 'Accounting Equation, Journal & Ledger Full One-Shot',
        duration: '55:00',
        tag: 'Commerce Exam Express',
        notes: 'Master the foundation of SSC Accounting in one focused session.'
      }
    ]
  }
};

// Smart fallback generator so EVERY Class + Group + Subject combination has realistic NCTB chapters
function getDefaultSubjectContent(classId, groupId, subjectId, subjectName) {
  const key = `${classId}_${groupId || 'general'}_${subjectId}`;
  return {
    basicToPro: [
      {
        id: `${key}-ch-1`,
        number: 'Chapter 01',
        title: `Foundations of ${subjectName} (প্রাথমিক ধারণা ও মূলপাঠ)`,
        videos: [
          {
            id: `${key}-v-1`,
            youtubeId: '5PcpBw5Hbwo',
            title: `Class ${classId} ${subjectName} — Chapter 1 Complete Concept Class`,
            duration: '24:30',
            notes: `Core NCTB textbook concepts, definitions, and board-standard creative question patterns for Class ${classId} ${subjectName}.`
          }
        ]
      },
      {
        id: `${key}-ch-2`,
        number: 'Chapter 02',
        title: `Core Principles & Board Applications (মূলনীতি ও প্রয়োগ)`,
        videos: [
          {
            id: `${key}-v-2`,
            youtubeId: 'NybHckSEQBI',
            title: `Chapter 2 Step-by-Step Guide & Practice Problems`,
            duration: '21:15',
            notes: 'Detailed walkthrough of key textbook exercises, short questions, and MCQ tricks.'
          }
        ]
      },
      {
        id: `${key}-ch-3`,
        number: 'Chapter 03',
        title: `Creative Questions & Analytical Mastery (সৃজনশীল প্রশ্ন বিশ্লেষণ)`,
        videos: [
          {
            id: `${key}-v-3`,
            youtubeId: 'uhxtUt_-GyM',
            title: `How to Score A+ in ${subjectName} Board Exams`,
            duration: '19:50',
            notes: 'Understanding Knowledge (ক), Comprehension (খ), Application (গ), and Higher-Order (ঘ) answer structures.'
          }
        ]
      }
    ],
    oneShot: [
      {
        id: `${key}-os-1`,
        youtubeId: '5PcpBw5Hbwo',
        title: `Class ${classId} ${subjectName} — Full Syllabus Exam-Night One-Shot Revision`,
        duration: '50:00',
        tag: 'Exam-Night Express',
        notes: `Complete last-night revision covering the most important chapters, formulas/rules, and likely exam questions for ${subjectName}.`
      }
    ]
  };
}

// ============================================================================
// 3. YOUTUBE URL PARSER UTILITY
// ============================================================================

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

// ============================================================================
// 4. FLOATING AI TUTOR WIDGET (GEMINI POWERED + SMART NCTB FALLBACK)
// ============================================================================

function FloatingAITutor({ contextInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Assalamu Alaikum! 👋 I am your **ShikkhaBD AI Tutor**. Ask me anything from your NCTB textbooks (Class 6–10) — Math formulas, Science concepts, Bangla/English grammar, or exam tips!'
    }
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickPrompts = useMemo(() => {
    if (contextInfo.subjectName) {
      return [
        `Key exam tips for ${contextInfo.subjectName}`,
        `Explain an important topic from Class ${contextInfo.classId} ${contextInfo.subjectName}`,
        `How to write a 10/10 Creative Question (সৃজনশীল)?`
      ];
    }
    return [
      'Explain Pythagoras theorem simply',
      'Summarize Newton’s 3 Laws of Motion',
      'Give me 5 English tense shortcuts'
    ];
  }, [contextInfo]);

  const generateFallbackReply = (query) => {
    const q = query.toLowerCase();
    if (q.includes('pythagoras')) {
      return `**Pythagoras Theorem (পিথাগোরাসের উপপাদ্য):**\n\nIn any right-angled triangle (সমকোণী ত্রিভুজ), the square of the hypotenuse (অতিভুজ) equals the sum of the squares of the other two sides:\n\n• **Formula:** $a^2 + b^2 = c^2$\n• **Example:** If base = 3 cm and height = 4 cm, then hypotenuse = $\\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5\\text{ cm}$.\n\n💡 *Exam Tip:* Always draw a neat labeled triangle before starting your geometric proof!`;
    }
    if (q.includes('newton')) {
      return `**Newton’s 3 Laws of Motion (নিউটনের গতির ৩টি সূত্র):**\n\n1. **1st Law (Inertia / জড়তা):** An object stays at rest or in uniform motion unless acted upon by an external force.\n2. **2nd Law ($F = ma$):** Rate of change of momentum is proportional to applied force. Here $F$ = Force (N), $m$ = mass (kg), $a$ = acceleration ($m/s^2$).\n3. **3rd Law (Action-Reaction):** Every action has an equal and opposite reaction (e.g., walking, rocket launch, gun recoil).`;
    }
    if (q.includes('creative') || q.includes('সৃজনশীল')) {
      return `**How to Score Full Marks in NCTB Creative Questions (সৃজনশীল - ১০ নম্বর):**\n\n• **ক (Knowledge - 1 mark):** Write 1 direct, accurate sentence from the textbook.\n• **খ (Comprehension - 2 marks):** Para 1: Define the term. Para 2: Explain *why* in 2–3 lines.\n• **গ (Application - 3 marks):** Connect the stem (উদ্দীপক) with textbook formulas/rules.\n• **ঘ (Higher-Order - 4 marks):** Give your analytical judgment + compare both sides clearly.`;
    }
    const ctx = contextInfo.subjectName
      ? `for **Class ${contextInfo.classId} ${contextInfo.subjectName}**`
      : 'for the **NCTB Curriculum**';
    return `Great question ${ctx}! 🌟\n\nHere is a clear study breakdown for **"${query}"**:\n1. **Core Concept:** Start by reviewing the main definition and textbook examples in your NCTB chapter.\n2. **Step-by-Step Practice:** Break the problem into known values, formula/rule, and final unit/conclusion.\n3. **Video Lesson:** Check the **Basic to Pro** tab for detailed lectures or **One-Shot Revision** for quick exam prep!\n\nWant me to quiz you with a sample MCQ on this topic?`;
  };

  const handleSend = async (customText) => {
    const question = (customText || input).trim();
    if (!question || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = '';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const contextSummary = contextInfo.classId
        ? `The student is currently browsing Class ${contextInfo.classId}${contextInfo.groupId ? ` (${contextInfo.groupId} group)` : ''}${contextInfo.subjectName ? `, Subject: ${contextInfo.subjectName}` : ''}.`
        : 'The student is on the ShikkhaBD home page.';

      const systemPrompt = `You are ShikkhaBD AI Tutor, a friendly, encouraging, and crystal-clear teacher for Bangladeshi school students (Class 6 to Class 10) following the NCTB curriculum. ${contextSummary} Keep answers concise, structured with bullet points, easy for a school student to understand, and occasionally include helpful Bengali key terms in parentheses where appropriate.`;

      const payload = {
        contents: [{ parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      // Exponential backoff fetch
      let response = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (response.ok) break;
        } catch (err) {
          if (attempt === 1) throw err;
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }

      if (response && response.ok) {
        const result = await response.json();
        const aiText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: aiText }]);
          setIsLoading(false);
          return;
        }
      }
      throw new Error('Fallback to local NCTB tutor');
    } catch {
      const fallback = generateFallbackReply(question);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open AI Tutor"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-5 py-3.5 text-white shadow-xl shadow-emerald-900/20 transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95"
      >
        {isOpen ? (
          <>
            <X className="h-5 w-5" />
            <span className="font-semibold text-sm">Close Tutor</span>
          </>
        ) : (
          <>
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-4 w-4 text-amber-200" />
            </div>
            <span className="font-semibold text-sm tracking-wide">AI Tutor</span>
          </>
        )}
      </button>

      {/* Slide-Up Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-5 z-50 flex w-[calc(100vw-2rem)] sm:w-[400px] max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">ShikkhaBD AI Tutor</h3>
                <p className="text-xs text-emerald-100">
                  {contextInfo.subjectName
                    ? `Class ${contextInfo.classId} • ${contextInfo.subjectName}`
                    : contextInfo.classId
                    ? `Class ${contextInfo.classId} NCTB Helper`
                    : 'NCTB Class 6–10 Instant Doubt Solver'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 min-h-[260px] max-h-[420px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200/80 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pl-9">
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.15s]" />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.3s]" />
                <span>Thinking like an NCTB teacher...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="border-t border-slate-100 bg-white px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask any NCTB question..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// ============================================================================
// 5. DUAL-TRACK LEARNING VIEW (INSIDE EVERY SUBJECT)
// ============================================================================

function SubjectLearningView({ classObj, groupObj, subjectObj, subjectContent, onBack }) {
  const [activeTrack, setActiveTrack] = useState('basicToPro'); // 'basicToPro' | 'oneShot'
  const chapters = subjectContent?.basicToPro || [];
  const oneShots = subjectContent?.oneShot || [];

  const [selectedChapterId, setSelectedChapterId] = useState(chapters[0]?.id || '');
  const [selectedVideoId, setSelectedVideoId] = useState(chapters[0]?.videos?.[0]?.id || '');
  const [selectedOneShotId, setSelectedOneShotId] = useState(oneShots[0]?.id || '');

  // Keep selections synced if subject changes
  useEffect(() => {
    const firstCh = chapters[0];
    setSelectedChapterId(firstCh?.id || '');
    setSelectedVideoId(firstCh?.videos?.[0]?.id || '');
    setSelectedOneShotId(oneShots[0]?.id || '');
  }, [subjectObj.id, classObj.id, groupObj?.id]);

  const activeChapter = chapters.find((c) => c.id === selectedChapterId) || chapters[0];
  const activeChapterVideo =
    activeChapter?.videos?.find((v) => v.id === selectedVideoId) || activeChapter?.videos?.[0];
  const activeOneShotVideo =
    oneShots.find((v) => v.id === selectedOneShotId) || oneShots[0];

  const handleSelectChapter = (chapter) => {
    setSelectedChapterId(chapter.id);
    if (chapter.videos && chapter.videos.length > 0) {
      setSelectedVideoId(chapter.videos[0].id);
    }
  };

  const SubjectIcon = subjectObj.icon || BookOpen;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Top Subject Header & Back Button */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Subjects</span>
          </button>
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${subjectObj.color} shadow-sm`}>
              <SubjectIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {classObj.label}
                </span>
                {groupObj && (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                    {groupObj.label}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {subjectObj.name}{' '}
                <span className="text-base font-medium text-slate-500">({subjectObj.bn})</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Dual-Track Pill Switcher */}
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5 shadow-inner self-start sm:self-auto">
          <button
            onClick={() => setActiveTrack('basicToPro')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTrack === 'basicToPro'
                ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>Basic to Pro</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {chapters.length} Ch
            </span>
          </button>

          <button
            onClick={() => setActiveTrack('oneShot')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTrack === 'oneShot'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className={`h-4 w-4 ${activeTrack === 'oneShot' ? 'text-white' : 'text-amber-500'}`} />
            <span>One-Shot Revision</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTrack === 'oneShot'
                  ? 'bg-white/25 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {oneShots.length}
            </span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: BASIC TO PRO (CHAPTER-WISE LEARNING)                          */}
      {/* ==================================================================== */}
      {activeTrack === 'basicToPro' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: NCTB Chapter Selector */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                NCTB Chapters ({chapters.length})
              </h2>
              <span className="text-xs text-emerald-700 font-medium">Step-by-Step</span>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {chapters.map((chapter) => {
                const isSelected = activeChapter?.id === chapter.id;
                const vidCount = chapter.videos?.length || 0;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => handleSelectChapter(chapter)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {chapter.number}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                        <Play className="h-3 w-3 text-emerald-600 fill-emerald-600" />
                        {vidCount} {vidCount === 1 ? 'Class' : 'Classes'}
                      </span>
                    </div>
                    <h3
                      className={`text-sm sm:text-base font-bold leading-snug mt-1.5 ${
                        isSelected ? 'text-emerald-950' : 'text-slate-800'
                      }`}
                    >
                      {chapter.title}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Embedded Video Player & Chapter Playlist */}
          <div className="lg:col-span-8">
            {activeChapterVideo ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {/* 16:9 Responsive YouTube Embed */}
                <div className="relative w-full pt-[56.25%] bg-slate-950">
                  <iframe
                    key={activeChapterVideo.youtubeId}
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${activeChapterVideo.youtubeId}?rel=0`}
                    title={activeChapterVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Video Details & Study Notes */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                      {activeChapter.number}
                    </span>
                    {activeChapterVideo.duration && (
                      <span className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        {activeChapterVideo.duration}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {activeChapterVideo.title}
                  </h2>

                  {activeChapterVideo.notes && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Quick Study Notes & Key Points</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activeChapterVideo.notes}
                      </p>
                    </div>
                  )}

                  {/* Playlist Switcher if multiple videos exist in this chapter */}
                  {activeChapter.videos.length > 1 && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        More Lectures in {activeChapter.number} ({activeChapter.videos.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {activeChapter.videos.map((vid, idx) => {
                          const isCurrent = vid.id === activeChapterVideo.id;
                          return (
                            <button
                              key={vid.id}
                              onClick={() => setSelectedVideoId(vid.id)}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                                isCurrent
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                  isCurrent
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{vid.title}</p>
                                <p className="text-xs text-slate-500">{vid.duration || 'Video Lesson'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Video className="h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No videos in this chapter yet</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Admins can add YouTube lectures anytime via the Admin Portal.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ONE-SHOT REVISION (EXAM-NIGHT EXPRESS PREP)                   */}
      {/* ==================================================================== */}
      {activeTrack === 'oneShot' && (
        <div className="space-y-6">
          {/* Exam-Night Express Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-5 sm:p-6 text-white shadow-md">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider mb-1">
                  Exam-Night Express Mode
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold">
                  Full-Book & Crash Revision Classes for {subjectObj.name}
                </h2>
                <p className="text-xs sm:text-sm text-amber-50 mt-0.5">
                  High-focus single-video marathons covering formulas, board CQs, and last-minute tips.
                </p>
              </div>
            </div>
          </div>

          {activeOneShotVideo ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Player */}
              <div className="lg:col-span-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="relative w-full pt-[56.25%] bg-slate-950">
                  <iframe
                    key={activeOneShotVideo.youtubeId}
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${activeOneShotVideo.youtubeId}?rel=0`}
                    title={activeOneShotVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      ⚡ {activeOneShotVideo.tag || 'One-Shot Revision'}
                    </span>
                    {activeOneShotVideo.duration && (
                      <span className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        {activeOneShotVideo.duration}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {activeOneShotVideo.title}
                  </h3>
                  {activeOneShotVideo.notes && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                        Exam Night Checklist
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activeOneShotVideo.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* One-Shot List */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">
                  Available One-Shot Sessions ({oneShots.length})
                </h3>
                {oneShots.map((item) => {
                  const isSelected = item.id === activeOneShotVideo.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedOneShotId(item.id)}
                      className={`w-full text-left rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-500/20'
                          : 'border-slate-200 bg-white hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          {item.tag || 'Crash Course'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {item.duration || 'Full Recap'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Zap className="h-10 w-10 text-amber-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">No One-Shot videos added yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Switch to "Basic to Pro" or add a One-Shot video from the Admin Portal.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. ZERO-STRESS ADMIN PORTAL (/admin CMS)
// ============================================================================

function AdminPortal({ curriculumData, onUpdateCurriculum, onResetDemoData, onExitAdmin }) {
  const [selectedClass, setSelectedClass] = useState('9');
  const [selectedGroup, setSelectedGroup] = useState('science');
  const [selectedSubject, setSelectedSubject] = useState('physics');
  const [selectedMode, setSelectedMode] = useState('basicToPro'); // 'basicToPro' | 'oneShot'

  // Chapter selection or new chapter creation
  const [chapterChoice, setChapterChoice] = useState('');
  const [isAddingNewChapter, setIsAddingNewChapter] = useState(false);
  const [newChapterNumber, setNewChapterNumber] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // Video form fields
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoNotes, setVideoNotes] = useState('');
  const [oneShotTag, setOneShotTag] = useState('Exam Night Special');
  const [toastMessage, setToastMessage] = useState(null);

  const isSenior = ['9', '10'].includes(selectedClass);
  const effectiveGroup = isSenior ? selectedGroup : 'general';
  const availableSubjects = useMemo(
    () => getSubjectsForSelection(selectedClass, selectedGroup),
    [selectedClass, selectedGroup]
  );

  // Sync subject when class or group changes
  useEffect(() => {
    if (!availableSubjects.some((s) => s.id === selectedSubject)) {
      setSelectedSubject(availableSubjects[0]?.id || 'math');
    }
  }, [availableSubjects, selectedSubject]);

  const storageKey = `${selectedClass}_${effectiveGroup}_${selectedSubject}`;
  const currentSubjectObj = availableSubjects.find((s) => s.id === selectedSubject) || availableSubjects[0];

  const currentSubjectData = useMemo(() => {
    return (
      curriculumData[storageKey] ||
      getDefaultSubjectContent(selectedClass, effectiveGroup, selectedSubject, currentSubjectObj?.name || 'Subject')
    );
  }, [curriculumData, storageKey, selectedClass, effectiveGroup, selectedSubject, currentSubjectObj]);

  // Sync selected chapter when subject changes
  useEffect(() => {
    const firstCh = currentSubjectData.basicToPro?.[0];
    if (firstCh) {
      setChapterChoice(firstCh.id);
      setIsAddingNewChapter(false);
    } else {
      setIsAddingNewChapter(true);
    }
  }, [storageKey]);

  const extractedVideoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePublishVideo = (e) => {
    e.preventDefault();
    if (!extractedVideoId) {
      showToast('Please paste a valid YouTube link or 11-character Video ID.', 'error');
      return;
    }
    if (!videoTitle.trim()) {
      showToast('Please enter a clear Video Title.', 'error');
      return;
    }

    const clonedSubject = JSON.parse(JSON.stringify(currentSubjectData));

    if (selectedMode === 'basicToPro') {
      const newVideoObj = {
        id: `vid-${Date.now()}`,
        youtubeId: extractedVideoId,
        title: videoTitle.trim(),
        duration: videoDuration.trim() || '20:00',
        notes: videoNotes.trim()
      };

      if (isAddingNewChapter) {
        if (!newChapterTitle.trim()) {
          showToast('Please enter the New Chapter Title.', 'error');
          return;
        }
        const chNum = newChapterNumber.trim() || `Chapter 0${clonedSubject.basicToPro.length + 1}`;
        const newCh = {
          id: `ch-${Date.now()}`,
          number: chNum,
          title: newChapterTitle.trim(),
          videos: [newVideoObj]
        };
        clonedSubject.basicToPro.push(newCh);
        setChapterChoice(newCh.id);
        setIsAddingNewChapter(false);
        setNewChapterNumber('');
        setNewChapterTitle('');
      } else {
        const targetCh = clonedSubject.basicToPro.find((c) => c.id === chapterChoice);
        if (targetCh) {
          targetCh.videos.push(newVideoObj);
        }
      }
    } else {
      // One-Shot Revision Mode
      const newOneShot = {
        id: `os-${Date.now()}`,
        youtubeId: extractedVideoId,
        title: videoTitle.trim(),
        duration: videoDuration.trim() || '45:00',
        tag: oneShotTag.trim() || 'Exam Night Special',
        notes: videoNotes.trim()
      };
      clonedSubject.oneShot.unshift(newOneShot);
    }

    onUpdateCurriculum(storageKey, clonedSubject);
    setYoutubeUrl('');
    setVideoTitle('');
    setVideoDuration('');
    setVideoNotes('');
    showToast('Published! Video is now live on the Student Frontend.');
  };

  const handleDeleteChapterVideo = (chapterId, videoId) => {
    const clonedSubject = JSON.parse(JSON.stringify(currentSubjectData));
    const ch = clonedSubject.basicToPro.find((c) => c.id === chapterId);
    if (ch) {
      ch.videos = ch.videos.filter((v) => v.id !== videoId);
      onUpdateCurriculum(storageKey, clonedSubject);
      showToast('Video removed from chapter.');
    }
  };

  const handleDeleteOneShot = (oneShotId) => {
    const clonedSubject = JSON.parse(JSON.stringify(currentSubjectData));
    clonedSubject.oneShot = clonedSubject.oneShot.filter((v) => v.id !== oneShotId);
    onUpdateCurriculum(storageKey, clonedSubject);
    showToast('One-Shot video removed.');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Admin Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-slate-900 p-5 sm:p-6 text-white shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/30">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                /admin CMS
              </span>
              <span className="text-xs text-slate-400">Instant Sync Enabled</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
              Zero-Stress Content Publisher
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onResetDemoData}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Sample Data</span>
          </button>
          <button
            onClick={onExitAdmin}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-500 transition"
          >
            <span>View Student Site</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`mb-6 flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-sm ${
            toastMessage.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cascading Publisher Form */}
        <form
          onSubmit={handlePublishVideo}
          className="lg:col-span-7 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-extrabold text-slate-900">1. Select Target Curriculum</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose Class, Group (for SSC), Subject, and Learning Track
            </p>
          </div>

          {/* Step 1: Cascading Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Select Class */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Class (শ্রেণি)
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              >
                {CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.bn})
                  </option>
                ))}
              </select>
            </div>

            {/* Select Group (Only Class 9 & 10) */}
            {isSenior ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Group (বিভাগ)
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5 text-sm font-semibold text-indigo-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label} ({g.bn})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Group (বিভাগ)
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-500">
                  Common Curriculum (No Group)
                </div>
              </div>
            )}

            {/* Select Subject */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Subject (বিষয়)
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              >
                {availableSubjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.name} ({subj.bn})
                  </option>
                ))}
              </select>
            </div>

            {/* Select Learning Mode */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Learning Mode
              </label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              >
                <option value="basicToPro">Basic to Pro (Chapter-wise)</option>
                <option value="oneShot">One-Shot Revision (Exam-Night)</option>
              </select>
            </div>
          </div>

          {/* Chapter Selector or Add New Chapter (for Basic to Pro) */}
          {selectedMode === 'basicToPro' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select or Create Chapter
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewChapter((prev) => !prev)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition"
                >
                  {isAddingNewChapter ? (
                    <>
                      <span>Choose Existing Chapter</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span>+ Add New Chapter</span>
                    </>
                  )}
                </button>
              </div>

              {!isAddingNewChapter ? (
                <select
                  value={chapterChoice}
                  onChange={(e) => setChapterChoice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  {currentSubjectData.basicToPro.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.number}: {ch.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Chapter 05"
                    value={newChapterNumber}
                    onChange={(e) => setNewChapterNumber(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="New Chapter Name (e.g. Reflection of Light)"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5">
                One-Shot Badge Label
              </label>
              <input
                type="text"
                value={oneShotTag}
                onChange={(e) => setOneShotTag(e.target.value)}
                placeholder="e.g. Exam Night Special / Full Book Crash"
                className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {/* Step 2: YouTube URL & Video Details */}
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900">2. Paste YouTube Video Link</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                YouTube Video URL *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
                <Youtube className="absolute left-3.5 top-2.5 h-5 w-5 text-rose-500" />
              </div>

              {/* Live Extracted Video ID Preview */}
              {youtubeUrl && (
                <div className="mt-2.5">
                  {extractedVideoId ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                      <img
                        src={`https://img.youtube.com/vi/${extractedVideoId}/mqdefault.jpg`}
                        alt="YouTube Thumbnail Preview"
                        className="h-14 w-24 rounded-lg object-cover bg-slate-900 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Valid YouTube ID Detected
                        </span>
                        <p className="text-xs font-mono text-slate-600 mt-0.5">
                          ID: <span className="font-bold text-slate-900">{extractedVideoId}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-rose-600">
                      Could not detect a valid YouTube ID yet. Paste a full link like youtube.com/watch?v=dQw4w9WgXcQ
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Video Title *
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g. Chapter 2: Equations of Motion Full Lecture"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Duration (Optional)
                </label>
                <input
                  type="text"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value)}
                  placeholder="e.g. 28:40"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Short Study Notes / Description (Optional)
              </label>
              <textarea
                rows={2}
                value={videoNotes}
                onChange={(e) => setVideoNotes(e.target.value)}
                placeholder="Key formulas, page numbers, or exam tips for students..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition"
            >
              <Plus className="h-5 w-5" />
              <span>Publish Video to Student Portal</span>
            </button>
          </div>
        </form>

        {/* Right: Live Published Content Manager for Selected Subject */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Live Preview & Manage
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Class {selectedClass} • {currentSubjectObj?.name}
                </h3>
              </div>
            </div>

            {/* Basic to Pro List */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Basic to Pro Chapters ({currentSubjectData.basicToPro.length})
              </h4>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {currentSubjectData.basicToPro.map((ch) => (
                  <div key={ch.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-xs font-bold text-emerald-800">{ch.number}</p>
                    <p className="text-sm font-bold text-slate-800 mb-2">{ch.title}</p>
                    <div className="space-y-1.5">
                      {ch.videos.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 border border-slate-200/80 text-xs"
                        >
                          <span className="truncate font-medium text-slate-700">{v.title}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteChapterVideo(ch.id, v.id)}
                            title="Delete video"
                            className="text-slate-400 hover:text-rose-600 p-1 transition shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* One-Shot List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                One-Shot Revision Videos ({currentSubjectData.oneShot.length})
              </h4>
              {currentSubjectData.oneShot.map((os) => (
                <div
                  key={os.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-amber-800 block">{os.tag}</span>
                    <span className="truncate block font-medium text-slate-800">{os.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOneShot(os.id)}
                    title="Delete One-Shot"
                    className="text-slate-400 hover:text-rose-600 p-1 transition shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. MAIN APPLICATION SHELL (2-CLICK NAVIGATION + STATE PERSISTENCE)
// ============================================================================

const STORAGE_KEY = 'shikkhabd_nctb_curriculum_v1';

export default function App() {
  // Persistent curriculum store
  const [curriculumData, setCurriculumData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback to initial data
    }
    return INITIAL_CURRICULUM_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(curriculumData));
    } catch {
      // Ignore storage quota issues
    }
  }, [curriculumData]);

  // Student 2-Click Routing State
  const [view, setView] = useState('home');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [subjectSearch, setSubjectSearch] = useState('');

  // Admin Login Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Deployment Guide Modal State
  const [showDeployGuide, setShowDeployGuide] = useState(false);

  const selectedClassObj = CLASSES.find((c) => c.id === selectedClassId);
  const selectedGroupObj = GROUPS.find((g) => g.id === selectedGroupId);
  const subjectsList = useMemo(() => {
    if (!selectedClassId) return [];
    return getSubjectsForSelection(selectedClassId, selectedGroupId);
  }, [selectedClassId, selectedGroupId]);

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return subjectsList;
    const q = subjectSearch.toLowerCase();
    return subjectsList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.bn.includes(q)
    );
  }, [subjectsList, subjectSearch]);

  const selectedSubjectObj = subjectsList.find((s) => s.id === selectedSubjectId);

  // Navigation Handlers
  const handleSelectClass = (classId) => {
    setSelectedClassId(classId);
    setSelectedSubjectId(null);
    setSubjectSearch('');
    if (['6', '7', '8'].includes(classId)) {
      setSelectedGroupId(null);
      setView('subjects');
    } else {
      setView('group');
    }
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setSubjectSearch('');
    setView('subjects');
  };

  const handleSelectSubject = (subjectId) => {
    setSelectedSubjectId(subjectId);
    setView('learning');
  };

  const handleGoHome = () => {
    setView('home');
    setSelectedClassId(null);
    setSelectedGroupId(null);
    setSelectedSubjectId(null);
    setSubjectSearch('');
  };

  const handleAdminButtonClick = () => {
    if (isAdminAuthenticated) {
      setView('admin');
    } else {
      setAdminPin('');
      setAdminError('');
      setShowAdminModal(true);
    }
  };

  const handleVerifyAdminPin = (e) => {
    e.preventDefault();
    if (adminPin.trim() === 'admin123') {
      setIsAdminAuthenticated(true);
      setShowAdminModal(false);
      setView('admin');
    } else {
      setAdminError('Incorrect PIN. Use demo PIN: admin123');
    }
  };

  const handleUpdateCurriculum = (key, updatedSubjectData) => {
    setCurriculumData((prev) => ({
      ...prev,
      [key]: updatedSubjectData
    }));
  };

  const handleResetDemoData = () => {
    setCurriculumData(INITIAL_CURRICULUM_DATA);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CURRICULUM_DATA));
  };

  const currentSubjectContent = useMemo(() => {
    if (!selectedClassId || !selectedSubjectId || !selectedSubjectObj) return null;
    const effGroup = ['9', '10'].includes(selectedClassId) ? selectedGroupId : 'general';
    const key = `${selectedClassId}_${effGroup}_${selectedSubjectId}`;
    return (
      curriculumData[key] ||
      getDefaultSubjectContent(selectedClassId, effGroup, selectedSubjectId, selectedSubjectObj.name)
    );
  }, [curriculumData, selectedClassId, selectedGroupId, selectedSubjectId, selectedSubjectObj]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200 selection:text-emerald-950 pb-20">
      {/* ==================================================================== */}
      {/* STICKY TOP NAVBAR WITH OFFICIAL MONOGRAM LOGO                        */}
      {/* ==================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Brand Logo & Name */}
          <button
            onClick={handleGoHome}
            className="flex items-center gap-3 text-left group"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden group-hover:scale-105 transition">
              {/* Official Monogram Logo SVG incorporating book and arrow motif */}
              <svg viewBox="0 0 100 100" className="h-9 w-9 text-blue-900" fill="currentColor">
                <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M50 14 L68 36 L50 48 L32 36 Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
                <path d="M50 14 L50 48" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M32 36 L18 52 L36 62 Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
                <path d="M68 36 L82 52 L64 62 Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
                <path d="M50 48 C50 68 40 76 34 82" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <path d="M42 66 Q52 64 56 68 Q60 72 52 78 Q44 84 54 88" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Shikkha<span className="text-emerald-600">BD</span>
                </span>
                <span className="hidden sm:inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                  NCTB
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Class 6–10 Smart Learning Platform
              </p>
            </div>
          </button>

          {/* Breadcrumb Pill (Desktop) */}
          {view !== 'home' && view !== 'admin' && selectedClassObj && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
              <button onClick={handleGoHome} className="hover:text-emerald-700">
                All Classes
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <button
                onClick={() => handleSelectClass(selectedClassObj.id)}
                className="hover:text-emerald-700 text-slate-800"
              >
                {selectedClassObj.label}
              </button>
              {selectedGroupObj && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    onClick={() => handleSelectGroup(selectedGroupObj.id)}
                    className="hover:text-emerald-700 text-indigo-700"
                  >
                    {selectedGroupObj.label}
                  </button>
                </>
              )}
              {selectedSubjectObj && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-emerald-700 font-bold">{selectedSubjectObj.name}</span>
                </>
              )}
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowDeployGuide(true)}
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <Globe className="h-4 w-4" />
              <span>How to Make Public?</span>
            </button>

            {view !== 'home' && (
              <button
                onClick={handleGoHome}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Home
              </button>
            )}

            <button
              onClick={handleAdminButtonClick}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
                view === 'admin'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-100/80 text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              {isAdminAuthenticated ? (
                <Unlock className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* VIEW 1: LANDING / CLASS SELECTION                                    */}
      {/* ==================================================================== */}
      {view === 'home' && (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-indigo-800 p-6 sm:p-10 text-white shadow-xl mb-10">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100 backdrop-blur-sm mb-4">
                <Award className="h-4 w-4 text-amber-300" />
                <span>100% Aligned with NCTB Bangladesh Curriculum</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                Your Free Digital Classroom for{' '}
                <span className="text-amber-300">Class 6 to Class 10</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-emerald-50/90 leading-relaxed">
                Pick your class below and start watching chapter-wise <strong>Basic to Pro</strong> lessons or exam-night <strong>One-Shot Revisions</strong> in just 2 clicks.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowDeployGuide(true)}
                  className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 shadow-md hover:bg-amber-300 transition"
                >
                  <Globe className="h-4 w-4" />
                  <span>How to Make Website Public? (পাবলিক করার নিয়ম)</span>
                </button>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          </div>

          {/* 5 Prominent Class Cards */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Select Your Class (তোমার শ্রেণি নির্বাচন করো)
            </h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              2-Click Learning
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            {CLASSES.map((cls) => (
              <button
                key={cls.id}
                onClick={() => handleSelectClass(cls.id)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl active:scale-[0.98]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${cls.color} text-xl font-black text-white shadow-md group-hover:scale-110 transition-transform`}
                    >
                      {cls.id}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls.lightBg} ${cls.text}`}>
                      {cls.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {cls.label}
                  </h3>
                  <p className="text-sm font-semibold text-slate-500 mt-0.5">{cls.bn}</p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs font-bold text-emerald-700">
                  <span>
                    {['9', '10'].includes(cls.id) ? 'Choose Group' : 'Open Subjects'}
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: GROUP SELECTION (CLASS 9 & 10)                               */}
      {/* ==================================================================== */}
      {view === 'group' && selectedClassObj && (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
          <button
            onClick={handleGoHome}
            className="mb-6 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Classes</span>
          </button>

          <div className="mb-8">
            <span className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
              {selectedClassObj.label} ({selectedClassObj.bn})
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Select Your Group (তোমার বিভাগ নির্বাচন করো)
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {GROUPS.map((grp) => {
              const Icon = grp.icon;
              return (
                <button
                  key={grp.id}
                  onClick={() => handleSelectGroup(grp.id)}
                  className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-xl active:scale-[0.98]"
                >
                  <div>
                    <div
                      className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${grp.gradient} text-white shadow-md group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {grp.label}
                    </h2>
                    <p className="text-sm font-bold text-slate-500 mt-0.5">{grp.bn}</p>
                    <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {grp.desc}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-indigo-700">
                    <span>View {grp.label} Subjects</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* ==================================================================== */}
      {/* VIEW 3: SUBJECT GRID                                                 */}
      {/* ==================================================================== */}
      {view === 'subjects' && selectedClassObj && (
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  ['9', '10'].includes(selectedClassObj.id) ? setView('group') : handleGoHome()
                }
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{['9', '10'].includes(selectedClassObj.id) ? 'Groups' : 'Classes'}</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {selectedClassObj.label}
                  </span>
                  {selectedGroupObj && (
                    <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                      {selectedGroupObj.label}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                  Choose a Subject to Start Learning
                </h1>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="Search subject..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSubjects.map((subj) => {
              const Icon = subj.icon || BookOpen;
              return (
                <button
                  key={subj.id}
                  onClick={() => handleSelectSubject(subj.id)}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${subj.color} group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {subj.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{subj.bn}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 group-hover:text-emerald-700">
                    <span>Basic to Pro • One-Shot</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* ==================================================================== */}
      {/* VIEW 4: DUAL-TRACK LEARNING MODULE                                   */}
      {/* ==================================================================== */}
      {view === 'learning' && selectedClassObj && selectedSubjectObj && currentSubjectContent && (
        <SubjectLearningView
          classObj={selectedClassObj}
          groupObj={selectedGroupObj}
          subjectObj={selectedSubjectObj}
          subjectContent={currentSubjectContent}
          onBack={() => setView('subjects')}
        />
      )}

      {/* ==================================================================== */}
      {/* VIEW 5: ADMIN PORTAL (/admin)                                        */}
      {/* ==================================================================== */}
      {view === 'admin' && isAdminAuthenticated && (
        <AdminPortal
          curriculumData={curriculumData}
          onUpdateCurriculum={handleUpdateCurriculum}
          onResetDemoData={handleResetDemoData}
          onExitAdmin={handleGoHome}
        />
      )}

      {/* ==================================================================== */}
      {/* DEPLOYMENT GUIDE MODAL ("HOW TO MAKE PUBLIC")                        */}
      {/* ==================================================================== */}
      {showDeployGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    How to Make ShikkhaBD 100% Public? (ওয়েবসাইট পাবলিক করার নিয়ম)
                  </h3>
                  <p className="text-xs text-slate-500">Step-by-step deployment guide for live web hosting</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeployGuide(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <h4 className="font-bold text-emerald-900 mb-1">💡 Why is the website currently private/local?</h4>
                <p className="text-xs text-slate-600">
                  Right now, you are running in a secure sandbox preview environment. To let students across Bangladesh access your website via a live public link (e.g., <code className="text-emerald-700 font-bold">https://shikkhabd.vercel.app</code>), you need to deploy the code to a free cloud hosting provider.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-extrabold text-slate-900">Method 1: Deploy on Vercel (Recommended & 100% Free)</h4>
                <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-600 pl-2">
                  <li>Download or copy the React code file generated here.</li>
                  <li>Create a free account on <a href="https://github.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">GitHub</a> and create a new repository (e.g., <code>shikkhabd</code>).</li>
                  <li>Upload your project files to GitHub.</li>
                  <li>Go to <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">Vercel.com</a>, sign in with GitHub, and click <strong>"Add New → Project"</strong>.</li>
                  <li>Import your <code>shikkhabd</code> repository and click <strong>Deploy</strong>.</li>
                  <li>Vercel will give you a public live link instantly that you can share with students anywhere!</li>
                </ol>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="font-extrabold text-slate-900">Method 2: Deploy on Netlify or Firebase</h4>
                <p className="text-xs text-slate-600">
                  You can also drag and drop your built React distribution folder onto <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">Netlify Drop</a> for an instant 10-second public deployment without using GitHub!
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setShowDeployGuide(false)}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN LOGIN MODAL                                                    */}
      {/* ==================================================================== */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Admin Portal Login</h3>
                  <p className="text-xs text-slate-500">Protected CMS Access</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Enter Admin PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Demo PIN: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-emerald-700">admin123</code>
                </p>
                {adminError && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">{adminError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
              >
                Unlock Admin CMS
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FLOATING AI TUTOR WIDGET                                             */}
      {/* ==================================================================== */}
      <FloatingAITutor
        contextInfo={{
          classId: selectedClassId,
          groupId: selectedGroupId,
          subjectName: selectedSubjectObj?.name
        }}
      />
    </div>
  );
}