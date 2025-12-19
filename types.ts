
export interface Skill {
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Expert';
}

export interface UserProfile {
  name: string;
  title: string;
  skills: Skill[];
  experience: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  snippet: string;
  url: string;
  matchScore?: number;
  trackingStatus?: 'Scouted' | 'Interested' | 'Applied' | 'Interviewing' | 'Rejected';
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface JobAnalysis {
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  resumeTips: string[];
  coverLetter: string;
  companyCulture: {
    values: string[];
    recentNews: string;
    pros: string[];
    cons: string[];
  };
  marketResearch: {
    industryTrends: string[];
    competitors: string[];
    salaryInsights: {
      low: number;
      high: number;
      average: number;
      currency: string;
      context: string;
    };
    growthOutlook: string;
    stabilityRating: 'High' | 'Medium' | 'Low';
  };
  interviewQuestions: {
    question: string;
    suggestedAnswer: string;
  }[];
  strategicAdvice: string;
  decisionSummary: string; // Evaluation of whether this is a "good decision"
}

export enum AppStep {
  PROFILE = 'PROFILE',
  SEARCH = 'SEARCH',
  ANALYSIS = 'ANALYSIS',
  TRACKER = 'TRACKER'
}

export interface FilterState {
  query: string;
  minScore: number;
  location: string;
}
