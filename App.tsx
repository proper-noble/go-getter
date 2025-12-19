
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserProfile, JobListing, JobAnalysis, AppStep, FilterState, ChatMessage } from './types';
import { CareerAgent } from './services/geminiService';
import Terminal from './components/Terminal';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.PROFILE);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    title: '',
    skills: [],
    experience: ''
  });
  const [newSkill, setNewSkill] = useState('');
  const [logs, setLogs] = useState<string[]>(['System initialized. Waiting for user profile...']);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [trackedJobs, setTrackedJobs] = useState<JobListing[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<'blueprint' | 'resume' | 'cover-letter' | 'culture' | 'market'>('blueprint');
  const [refinementInput, setRefinementInput] = useState('');
  const [agent] = useState(() => new CareerAgent());

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    minScore: 0,
    location: ''
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), msg]);

  const addSkill = () => {
    if (newSkill.trim()) {
      setProfile(p => ({
        ...p,
        skills: [...p.skills, { name: newSkill.trim(), level: 'Intermediate' }]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (name: string) => {
    setProfile(p => ({
      ...p,
      skills: p.skills.filter(s => s.name !== name)
    }));
  };

  const startJobSearch = async () => {
    if (!profile.title || profile.skills.length === 0) return;
    setIsLoading(true);
    setStep(AppStep.SEARCH);
    addLog(`Agent "Stagehand" scouting...`);
    try {
      const { jobs: foundJobs } = await agent.discoverJobs(profile);
      setJobs(foundJobs);
      addLog(`Discovery complete. Found ${foundJobs.length} leads.`);
    } catch (error) {
      addLog(`ERR: Scouting failed.`);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeJobDetail = async (job: JobListing) => {
    setIsLoading(true);
    setSelectedJob(job);
    setStep(AppStep.ANALYSIS);
    setAnalysisTab('blueprint');
    setChatMessages([]);
    setShowChat(false);
    addLog(`Initiating deep scan & market research for ${job.company}...`);
    try {
      const result = await agent.analyzeJob(profile, job);
      setAnalysis(result);
      addLog(`Analysis complete. Alignment: ${result.matchScore}%`);
    } catch (error) {
      addLog(`ERR: Deep scan failed.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefineResume = async () => {
    if (!refinementInput.trim() || !analysis || !selectedJob) return;
    setIsRefining(true);
    addLog(`Refining resume based on: "${refinementInput}"`);
    try {
      const refined = await agent.refineResume(analysis.resumeTips, selectedJob, refinementInput);
      setAnalysis({ ...analysis, resumeTips: refined });
      setRefinementInput('');
      addLog(`Resume optimization updated.`);
    } catch (error) {
      addLog(`ERR: Refinement failed.`);
    } finally {
      setIsRefining(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !selectedJob || !analysis) return;
    const userMsg: ChatMessage = { role: 'user', parts: [{ text: chatInput }] };
    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setIsChatLoading(true);
    try {
      const reply = await agent.sendMessage(chatMessages, currentInput, selectedJob, analysis);
      setChatMessages(prev => [...prev, { role: 'model', parts: [{ text: reply }] }]);
    } catch (error) {
      addLog('ERR: Chat agent unavailable.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesQuery = job.title.toLowerCase().includes(filters.query.toLowerCase()) || 
                           job.company.toLowerCase().includes(filters.query.toLowerCase());
      const matchesScore = (job.matchScore || 0) >= filters.minScore;
      const matchesLocation = !filters.location || job.location.toLowerCase().includes(filters.location.toLowerCase());
      return matchesQuery && matchesScore && matchesLocation;
    });
  }, [jobs, filters]);

  const trackJob = (job: JobListing, status: JobListing['trackingStatus'] = 'Interested') => {
    const updatedJob = { ...job, trackingStatus: status };
    setTrackedJobs(prev => {
      const exists = prev.find(j => j.id === job.id);
      if (exists) return prev.map(j => j.id === job.id ? updatedJob : j);
      return [...prev, updatedJob];
    });
    addLog(`${job.company} status: ${status}.`);
  };

  const formatCurrency = (val: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-48 relative">
      <header className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded flex items-center justify-center text-slate-950 font-bold">
            <i className="fa-solid fa-robot"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Stagehand <span className="text-teal-400">Career Pilot</span></h1>
            <p className="text-slate-400 text-sm italic">Automated Preparation Engine</p>
          </div>
        </div>
        <button onClick={() => setStep(AppStep.TRACKER)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === AppStep.TRACKER ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
          <i className="fa-solid fa-list-check"></i> Tracker ({trackedJobs.length})
        </button>
      </header>

      <section className="mb-8">
        <Terminal logs={logs} />
      </section>

      {step === AppStep.PROFILE && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-bold">1. Build Your Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1 font-mono uppercase tracking-tighter">Target Job Title</label>
              <input type="text" value={profile.title} onChange={e => setProfile({...profile, title: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500 outline-none transition-all" placeholder="e.g. Senior Frontend Engineer" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1 font-mono uppercase tracking-tighter">Skills</label>
              <div className="flex gap-2 mb-3">
                <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyPress={e => e.key === 'Enter' && addSkill()} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Add a skill..." />
                <button onClick={addSkill} className="bg-teal-600 hover:bg-teal-500 px-6 rounded-lg font-bold transition-colors uppercase text-xs tracking-widest">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(skill => (
                  <span key={skill.name} className="bg-teal-500/10 text-teal-400 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                    {skill.name}
                    <button onClick={() => removeSkill(skill.name)} className="hover:text-red-400"><i className="fa-solid fa-xmark"></i></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={startJobSearch} disabled={!profile.title || profile.skills.length === 0} className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black text-lg transition-all shadow-xl shadow-teal-950/20 uppercase tracking-widest">
            Execute Discovery Agent
          </button>
        </section>
      )}

      {step === AppStep.SEARCH && (
        <section className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dynamic Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" placeholder="Search keywords..." value={filters.query} onChange={e => setFilters({...filters, query: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Match Threshold</span>
                  <span>{filters.minScore}%</span>
                </div>
                <input type="range" min="0" max="100" value={filters.minScore} onChange={e => setFilters({...filters, minScore: parseInt(e.target.value)})} className="w-full accent-teal-500" />
              </div>
              <input type="text" placeholder="Location filter..." value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map(job => (
              <div key={job.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-teal-500/50 transition-all flex flex-col justify-between group relative overflow-hidden">
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-400">
                  {job.matchScore}%
                </div>
                <div>
                  <span className="text-xs text-teal-400 font-mono uppercase mb-1 block">{job.company}</span>
                  <h3 className="font-bold text-lg leading-tight mb-2 pr-12">{job.title}</h3>
                  <p className="text-slate-400 text-xs mb-4">{job.location}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => analyzeJobDetail(job)} className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white border border-teal-500/20 rounded-lg text-xs font-bold transition-all uppercase tracking-widest">Analyze</button>
                  <button onClick={() => trackJob(job)} className="px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><i className="fa-solid fa-bookmark"></i></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === AppStep.ANALYSIS && selectedJob && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedJob.title}</h2>
              <p className="text-slate-400">{selectedJob.company} • {selectedJob.location}</p>
            </div>
            <button onClick={() => setStep(AppStep.SEARCH)} className="text-slate-400 hover:text-white text-sm"><i className="fa-solid fa-arrow-left mr-1"></i> Back</button>
          </div>

          {isLoading ? (
            <div className="py-24 text-center text-slate-500">
              <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="mono animate-pulse uppercase tracking-widest">Conducting Web Research & Salary Parsing...</p>
            </div>
          ) : analysis && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
                {['blueprint', 'resume', 'cover-letter', 'culture', 'market'].map((tab) => (
                  <button key={tab} onClick={() => setAnalysisTab(tab as any)} className={`flex-1 min-w-[80px] py-2 rounded-lg text-[10px] font-bold capitalize transition-all ${analysisTab === tab ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    {tab.replace('-', ' ')}
                  </button>
                ))}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl min-h-[400px] shadow-2xl overflow-hidden">
                {analysisTab === 'blueprint' && (
                  <div className="p-8 space-y-6">
                    <div className="p-6 bg-teal-500/5 border border-teal-500/20 rounded-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 text-teal-500/10">
                        <i className="fa-solid fa-gavel text-4xl"></i>
                      </div>
                      <h4 className="font-bold text-teal-400 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                        <i className="fa-solid fa-robot"></i> Agent Verdict
                      </h4>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium">{analysis.decisionSummary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-xl">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Strategic Advice</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{analysis.strategicAdvice}</p>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Top Interview Drills</h4>
                        {analysis.interviewQuestions.map((q, i) => (
                          <div key={i} className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg text-[11px]">
                            <p className="font-bold text-teal-500 mb-1">Scenario: {q.question}</p>
                            <p className="text-slate-400 italic">"{q.suggestedAnswer}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {analysisTab === 'resume' && (
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-white">Application Tailoring Bullets</h3>
                      <button onClick={() => navigator.clipboard.writeText(analysis.resumeTips.join('\n'))} className="text-teal-400 text-xs hover:underline flex items-center gap-1"><i className="fa-solid fa-copy"></i> Copy All</button>
                    </div>
                    <ul className="space-y-4">
                      {analysis.resumeTips.map((tip, i) => (
                        <li key={i} className="bg-slate-950 p-5 border border-slate-800 rounded-xl text-sm text-slate-200 flex gap-4 hover:border-teal-500/30 transition-colors">
                          <i className="fa-solid fa-wand-magic-sparkles text-teal-500 mt-1 shrink-0"></i>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-8 border-t border-slate-800 space-y-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Iterative Refinement</h4>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Refine further (e.g. 'incorporate more AWS experience')..." value={refinementInput} onChange={e => setRefinementInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleRefineResume()} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-teal-500 transition-all" />
                        <button onClick={handleRefineResume} disabled={isRefining} className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest">
                          {isRefining ? 'Adapting...' : 'Refine'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {analysisTab === 'cover-letter' && (
                  <div className="p-8">
                    <div className="bg-slate-950 p-8 border border-slate-800 rounded-2xl text-sm text-slate-300 leading-relaxed h-[450px] overflow-y-auto whitespace-pre-wrap font-serif custom-scrollbar">
                      {analysis.coverLetter}
                    </div>
                  </div>
                )}

                {analysisTab === 'culture' && (
                  <div className="p-8 space-y-8">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-l-2 border-teal-500 pl-3">Company Insights</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase">Cultural Values</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {analysis.companyCulture.values.map(v => <div key={v} className="text-sm bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3"><i className="fa-solid fa-check text-teal-500"></i> {v}</div>)}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase">Internal Pulse</h4>
                        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-xs italic leading-relaxed text-slate-300 relative">
                          <i className="fa-solid fa-quote-left absolute top-3 left-3 text-slate-800 text-xl"></i>
                          <span className="relative z-10">{analysis.companyCulture.recentNews}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {analysisTab === 'market' && (
                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Salary Range Visualization */}
                      <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest">Salary Benchmarks</h4>
                          <span className="text-[10px] text-slate-500">{analysis.marketResearch.salaryInsights.context}</span>
                        </div>
                        <div className="relative pt-6">
                          <div className="h-2 bg-slate-800 rounded-full w-full"></div>
                          {/* Scale lines */}
                          <div className="absolute top-6 left-0 h-2 border-l border-slate-700"></div>
                          <div className="absolute top-6 right-0 h-2 border-l border-slate-700"></div>
                          
                          {/* Range Bar */}
                          <div 
                            className="absolute top-6 h-2 bg-teal-500 rounded-full opacity-50"
                            style={{ 
                              left: `${(analysis.marketResearch.salaryInsights.low / (analysis.marketResearch.salaryInsights.high * 1.2)) * 100}%`,
                              right: `${100 - (analysis.marketResearch.salaryInsights.high / (analysis.marketResearch.salaryInsights.high * 1.2)) * 100}%` 
                            }}
                          ></div>
                          
                          {/* Average Point */}
                          <div 
                            className="absolute top-5 w-4 h-4 bg-white rounded-full border-4 border-teal-600 shadow-lg -translate-x-2"
                            style={{ left: `${(analysis.marketResearch.salaryInsights.average / (analysis.marketResearch.salaryInsights.high * 1.2)) * 100}%` }}
                          ></div>

                          <div className="flex justify-between mt-4 text-[10px] font-mono">
                            <span className="text-slate-400">MIN: {formatCurrency(analysis.marketResearch.salaryInsights.low, analysis.marketResearch.salaryInsights.currency)}</span>
                            <span className="text-white font-bold bg-teal-900/40 px-2 py-0.5 rounded">AVG: {formatCurrency(analysis.marketResearch.salaryInsights.average, analysis.marketResearch.salaryInsights.currency)}</span>
                            <span className="text-slate-400">MAX: {formatCurrency(analysis.marketResearch.salaryInsights.high, analysis.marketResearch.salaryInsights.currency)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
                          <h4 className="text-xs font-bold text-teal-400 uppercase mb-3 flex justify-between">
                            Growth Outlook 
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                              analysis.marketResearch.stabilityRating === 'High' ? 'bg-green-500/20 text-green-400' :
                              analysis.marketResearch.stabilityRating === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              STABILITY: {analysis.marketResearch.stabilityRating}
                            </span>
                          </h4>
                          <p className="text-xs text-slate-300 italic">"{analysis.marketResearch.growthOutlook}"</p>
                        </div>
                        <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">Main Competitors</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.marketResearch.competitors.map(c => <span key={c} className="text-[10px] bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">{c}</span>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Feature Toggle */}
          <button 
            onClick={() => setShowChat(!showChat)}
            className="fixed bottom-24 right-8 w-16 h-16 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center text-white z-50 hover:bg-teal-500 transition-all hover:scale-110 active:scale-95 group"
          >
            <div className="absolute -top-1 -right-1 bg-red-500 text-[8px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-950 group-hover:animate-bounce">
              AI
            </div>
            <i className={`fa-solid ${showChat ? 'fa-xmark' : 'fa-comment-dots'} text-2xl`}></i>
          </button>

          {/* Chat Window */}
          {showChat && (
            <div className="fixed bottom-44 right-8 w-[320px] md:w-[400px] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
              <div className="bg-slate-900 p-5 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center text-white">
                    <i className="fa-solid fa-user-ninja"></i>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-teal-400 leading-none">Career Co-Pilot</h3>
                    <span className="text-[8px] text-green-500 animate-pulse">AUTONOMOUS AGENT ACTIVE</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 h-[350px] md:h-[450px] overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-950/50 backdrop-blur-sm">
                {chatMessages.length === 0 && (
                  <div className="text-center mt-12 space-y-4">
                    <p className="text-slate-500 text-xs italic px-6">Discuss negotiation strategy, detailed interview drills, or competitor deep-dives for this role.</p>
                    <div className="flex flex-wrap gap-2 justify-center px-4">
                      {["How should I negotiate?", "Interview me for this", "Company outlook?"].map(hint => (
                        <button key={hint} onClick={() => { setChatInput(hint); }} className="text-[10px] bg-slate-900 hover:bg-teal-900/30 text-slate-400 hover:text-teal-400 border border-slate-800 rounded-full px-3 py-1.5 transition-all">{hint}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50 shadow-lg'}`}>
                      {msg.parts[0].text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none animate-pulse flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef}></div>
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                <input 
                  type="text" 
                  placeholder="Query agent about this role..." 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleChat()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-teal-500 transition-all shadow-inner" 
                />
                <button 
                  onClick={handleChat}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="w-10 h-10 bg-teal-600 hover:bg-teal-500 rounded-2xl flex items-center justify-center text-white disabled:opacity-50 transition-all active:scale-90"
                >
                  <i className="fa-solid fa-paper-plane text-xs"></i>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {step === AppStep.TRACKER && (
        <section className="space-y-6 animate-in fade-in duration-300">
           <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Application Pipeline</h2>
            <button onClick={() => setStep(AppStep.SEARCH)} className="text-slate-400 hover:text-white text-sm transition-colors"><i className="fa-solid fa-radar mr-1"></i> Back to Search</button>
          </div>
          {trackedJobs.length === 0 ? (
            <div className="py-32 text-center text-slate-600 space-y-4">
              <i className="fa-solid fa-folder-open text-5xl opacity-10"></i>
              <p className="italic">No tracked leads yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trackedJobs.map(job => (
                <div key={job.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between gap-6 group hover:border-teal-500/30 transition-all">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-100 group-hover:text-white transition-colors">{job.title}</h4>
                    <p className="text-xs text-slate-500">{job.company} • {job.location}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <select value={job.trackingStatus} onChange={(e) => {
                      const newStatus = e.target.value as any;
                      setTrackedJobs(prev => prev.map(j => j.id === job.id ? { ...j, trackingStatus: newStatus } : j));
                    }} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[10px] font-bold text-teal-400 focus:ring-1 focus:ring-teal-500 outline-none cursor-pointer">
                      <option value="Interested">Interested</option>
                      <option value="Applied">Applied</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <button onClick={() => analyzeJobDetail(job)} className="p-3 bg-slate-800 hover:bg-teal-600/20 text-slate-400 hover:text-teal-400 rounded-xl transition-all shadow-lg"><i className="fa-solid fa-eye"></i></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/50 p-6 z-[40]">
        <div className="max-w-4xl mx-auto flex items-center justify-around">
          <button onClick={() => setStep(AppStep.PROFILE)} className={`flex flex-col items-center gap-2 transition-all ${step === AppStep.PROFILE ? 'text-teal-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <i className={`fa-solid fa-id-card text-xl`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Profile</span>
          </button>
          <button onClick={() => setStep(AppStep.SEARCH)} className={`flex flex-col items-center gap-2 transition-all ${step === AppStep.SEARCH ? 'text-teal-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <i className={`fa-solid fa-radar text-xl`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Scouts</span>
          </button>
          <button onClick={() => setStep(AppStep.TRACKER)} className={`flex flex-col items-center gap-2 transition-all ${step === AppStep.TRACKER ? 'text-teal-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <i className={`fa-solid fa-diagram-project text-xl`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Pipeline</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
