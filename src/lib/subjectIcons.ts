import type { LucideIcon } from 'lucide-react';
import {
  Atom,
  BookOpen,
  Briefcase,
  Calculator,
  Compass,
  Cpu,
  Dna,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  Home,
  Landmark,
  Languages,
  Moon,
  Palette,
  Scale,
  Sparkles,
  Sprout,
  Sun,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import type { SubjectGroup } from '../types';

export interface SubjectVisual {
  icon: LucideIcon;
  badgeClass: string;
}

export function getSubjectVisual(subjectId: string, title = ''): SubjectVisual {
  const key = `${subjectId} ${title}`.toLowerCase();

  if (key.includes('higher')) {
    return {
      icon: Calculator,
      badgeClass: 'bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    };
  }
  if (key.includes('math')) {
    return {
      icon: Calculator,
      badgeClass: 'bg-sky-100/90 text-[#172554] dark:bg-sky-950/70 dark:text-[#BFE8FF]',
    };
  }
  if (key.includes('physics')) {
    return {
      icon: Atom,
      badgeClass: 'bg-violet-100/90 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
    };
  }
  if (key.includes('chemistry')) {
    return {
      icon: FlaskConical,
      badgeClass: 'bg-rose-100/90 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300',
    };
  }
  if (key.includes('biology')) {
    return {
      icon: Dna,
      badgeClass: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    };
  }
  if (key.includes('home-science') || key.includes('home science') || key.includes('গার্হস্থ্য')) {
    return {
      icon: Home,
      badgeClass: 'bg-pink-100/90 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300',
    };
  }
  if (key.includes('science')) {
    return {
      icon: FlaskConical,
      badgeClass: 'bg-teal-100/90 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300',
    };
  }
  if (key.includes('ict')) {
    return {
      icon: Cpu,
      badgeClass: 'bg-cyan-100/90 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300',
    };
  }
  if (key.includes('bangla-2') || key.includes('bangla 2')) {
    return {
      icon: Languages,
      badgeClass: 'bg-teal-100/90 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300',
    };
  }
  if (key.includes('bangla')) {
    return {
      icon: BookOpen,
      badgeClass: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    };
  }
  if (key.includes('english-2') || key.includes('english 2')) {
    return {
      icon: FileText,
      badgeClass: 'bg-sky-100/90 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300',
    };
  }
  if (key.includes('english')) {
    return {
      icon: Globe,
      badgeClass: 'bg-blue-100/90 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
    };
  }
  if (key.includes('bgs') || key.includes('global')) {
    return {
      icon: Compass,
      badgeClass: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    };
  }
  if (key.includes('hindu')) {
    return {
      icon: Sun,
      badgeClass: 'bg-orange-100/90 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300',
    };
  }
  if (key.includes('buddh') || key.includes('christ')) {
    return {
      icon: Sparkles,
      badgeClass: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    };
  }
  if (key.includes('islam') || key.includes('religion')) {
    return {
      icon: Moon,
      badgeClass: 'bg-green-100/90 text-green-700 dark:bg-green-950/70 dark:text-green-300',
    };
  }
  if (key.includes('agri')) {
    return {
      icon: Sprout,
      badgeClass: 'bg-lime-100/90 text-lime-700 dark:bg-lime-950/70 dark:text-lime-300',
    };
  }
  if (key.includes('physical') || key.includes('health')) {
    return {
      icon: HeartPulse,
      badgeClass: 'bg-red-100/90 text-red-700 dark:bg-red-950/70 dark:text-red-300',
    };
  }
  if (key.includes('arts-crafts') || key.includes('charu') || key.includes('craft')) {
    return {
      icon: Palette,
      badgeClass: 'bg-fuchsia-100/90 text-fuchsia-700 dark:bg-fuchsia-950/70 dark:text-fuchsia-300',
    };
  }
  if (key.includes('work-life') || key.includes('work')) {
    return {
      icon: Wrench,
      badgeClass: 'bg-slate-200/90 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  if (key.includes('career')) {
    return {
      icon: Briefcase,
      badgeClass: 'bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    };
  }
  if (key.includes('history')) {
    return {
      icon: Landmark,
      badgeClass: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    };
  }
  if (key.includes('geography')) {
    return {
      icon: Globe,
      badgeClass: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    };
  }
  if (key.includes('civics')) {
    return {
      icon: Scale,
      badgeClass: 'bg-blue-100/90 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
    };
  }
  if (key.includes('economics')) {
    return {
      icon: TrendingUp,
      badgeClass: 'bg-purple-100/90 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300',
    };
  }
  if (key.includes('accounting')) {
    return {
      icon: Calculator,
      badgeClass: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    };
  }
  if (key.includes('finance')) {
    return {
      icon: TrendingUp,
      badgeClass: 'bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    };
  }
  if (key.includes('business')) {
    return {
      icon: Briefcase,
      badgeClass: 'bg-amber-100/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    };
  }

  return {
    icon: BookOpen,
    badgeClass: 'bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]',
  };
}

export interface ClassMeta {
  numeral: string;
  levelEn: string;
  levelBn: string;
  gradient: string;
}

export function getClassMeta(classId: string): ClassMeta {
  const numMatch = classId.match(/\d+/);
  const numeral = numMatch ? numMatch[0] : classId.slice(0, 2);

  switch (classId) {
    case 'class-6':
      return {
        numeral: '6',
        levelEn: 'Junior Secondary',
        levelBn: 'নিম্ন মাধ্যমিক',
        gradient: 'from-[#0284C7] to-[#263B91]',
      };
    case 'class-7':
      return {
        numeral: '7',
        levelEn: 'Junior Secondary',
        levelBn: 'নিম্ন মাধ্যমিক',
        gradient: 'from-[#0EA5E9] to-[#1D4ED8]',
      };
    case 'class-8':
      return {
        numeral: '8',
        levelEn: 'Junior Board Prep',
        levelBn: 'জুনিয়র প্রস্তুতি',
        gradient: 'from-[#263B91] to-[#172554]',
      };
    case 'class-9':
      return {
        numeral: '9',
        levelEn: 'SSC Foundation',
        levelBn: 'এসএসসি ভিত্তি',
        gradient: 'from-[#172554] to-[#3730A3]',
      };
    case 'class-10':
      return {
        numeral: '10',
        levelEn: 'SSC Candidate',
        levelBn: 'এসএসসি পরীক্ষার্থী',
        gradient: 'from-[#172554] to-[#0F172A]',
      };
    default:
      return {
        numeral,
        levelEn: 'NCTB Track',
        levelBn: 'পাঠ্যক্রম',
        gradient: 'from-[#263B91] to-[#172554]',
      };
  }
}

export interface GroupOptionMeta {
  id: Exclude<SubjectGroup, 'common'>;
  titleEn: string;
  titleBn: string;
  descEn: string;
  descBn: string;
  icon: LucideIcon;
  gradient: string;
}

export const GROUP_OPTIONS: GroupOptionMeta[] = [
  {
    id: 'science',
    titleEn: 'Science',
    titleBn: 'বিজ্ঞান',
    descEn: 'Physics, Chemistry, Biology, Higher Math & Core Subjects',
    descBn: 'পদার্থবিজ্ঞান, রসায়ন, জীববিজ্ঞান, উচ্চতর গণিত ও আবশ্যিক বিষয়',
    icon: Atom,
    gradient: 'from-[#172554] to-[#0284C7]',
  },
  {
    id: 'arts',
    titleEn: 'Arts / Humanities',
    titleBn: 'মানবিক',
    descEn: 'History, Geography, Civics, Economics & Core Subjects',
    descBn: 'ইতিহাস, ভূগোল, পৌরনীতি, অর্থনীতি ও আবশ্যিক বিষয়',
    icon: Landmark,
    gradient: 'from-[#0F766E] to-[#0284C7]',
  },
  {
    id: 'commerce',
    titleEn: 'Commerce / Business',
    titleBn: 'ব্যবসায় শিক্ষা',
    descEn: 'Accounting, Finance & Banking, Entrepreneurship & Core',
    descBn: 'হিসাববিজ্ঞান, ফিন্যান্স ও ব্যাংকিং, ব্যবসায় উদ্যোগ ও আবশ্যিক',
    icon: TrendingUp,
    gradient: 'from-[#B45309] to-[#263B91]',
  },
];
