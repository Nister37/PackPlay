import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  Trash2,
  X,
  RefreshCw,
  MessageSquare,
  ListPlus,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { parseNaturalLanguageGearList, type ParsedSmartItem } from '@/lib/smartEntry';
import api from '@/lib/api';

interface GemmaAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptItems: (items: ParsedSmartItem[]) => void;
  eventContext?: {
    sport?: string;
    title?: string;
    location?: string;
    weatherDescription?: string;
    temperatureC?: number;
    memberCount?: number;
  };
  isSubmitting?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function GemmaAssistantModal({
  isOpen,
  onClose,
  onAcceptItems,
  eventContext,
  isSubmitting = false,
}: GemmaAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<'parse' | 'suggest' | 'chat'>('parse');

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const tabList = [
    { key: 'parse', label: 'Natural Language Parser', Icon: ListPlus },
    { key: 'suggest', label: 'Gemma Recommendations', Icon: Lightbulb },
    { key: 'chat', label: 'Gemma Advice & Chat', Icon: MessageSquare },
  ] as const;

  const activeIndex = tabList.findIndex((t) => t.key === activeTab);

  const updateTabIndicator = () => {
    const activeEl = tabRefs.current[activeIndex];
    const container = tabContainerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
        ready: true,
      });
    }
  };

  useEffect(() => {
    updateTabIndicator();
    const frameId = requestAnimationFrame(updateTabIndicator);
    return () => cancelAnimationFrame(frameId);
  }, [activeIndex, isOpen]);

  // Parse state
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedSmartItem[]>([]);

  // Suggest state
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<ParsedSmartItem[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your Gemma AI Equipment Assistant. Ask me anything about matchday preparation, weather adaptations, or gear checklists.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Gemma NLP parse
  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    try {
      const res = await api.post('/ai/gemma/parse', { text: inputText });
      if (res.data?.items && Array.isArray(res.data.items) && res.data.items.length > 0) {
        setParsedItems(res.data.items);
      } else {
        // Fallback to client-side rule-based parser
        setParsedItems(parseNaturalLanguageGearList(inputText));
      }
    } catch {
      // Offline fallback
      setParsedItems(parseNaturalLanguageGearList(inputText));
    } finally {
      setIsParsing(false);
    }
  };

  // Handle Gemma Suggestions
  const handleFetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const res = await api.post('/ai/gemma/suggest', {
        sport: eventContext?.sport || 'General Sports',
        sportType: eventContext?.sport || 'General Sports',
        eventName: eventContext?.title || 'Match / Session',
        eventType: eventContext?.title || 'Match / Session',
        location: eventContext?.location,
        weatherCondition: eventContext?.weatherDescription,
        temperatureC: eventContext?.temperatureC,
        memberCount: eventContext?.memberCount || 15,
        squadSize: eventContext?.memberCount || 15,
      });

      const list: ParsedSmartItem[] = res.data?.items || res.data?.suggestions || [];
      setSuggestedItems(list);
      // Select all by default
      const initialSelection: Record<number, boolean> = {};
      list.forEach((_, idx) => {
        initialSelection[idx] = true;
      });
      setSelectedSuggestions(initialSelection);
    } catch {
      // Dynamic fallback suggestions based on sport & activity title
      const sportLower = `${eventContext?.sport || ''} ${eventContext?.title || ''}`.toLowerCase();
      let fallbackList: ParsedSmartItem[] = [];

      if (sportLower.includes('basket')) {
        fallbackList = [
          { name: 'Official Size 7 Match Basketballs', quantity: 3, category: 'BALLS', target: 'SHARED', isMandatory: true, reason: 'Regulation competition game balls' },
          { name: 'Numbered Tactical Scrimmage Pinnies (Set of 10)', quantity: 1, category: 'APPAREL', target: 'SHARED', isMandatory: true, reason: 'Court scrimmage rotation' },
          { name: 'Ankle Braces & Athletic Strapping Tape', quantity: 1, category: 'MEDICAL', target: 'SHARED', isMandatory: true, reason: 'High-impact joint support' },
          { name: 'Team Water Cooler Dispenser (10L)', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Sideline court hydration' },
        ];
      } else if (sportLower.includes('tennis') || sportLower.includes('padel')) {
        fallbackList = [
          { name: 'Pressurized Match Tennis Balls (Cans of 4)', quantity: 4, category: 'BALLS', target: 'SHARED', isMandatory: true, reason: 'Championship match play balls' },
          { name: 'Racquet Grip Overgrips & Dampeners', quantity: 2, category: 'EQUIPMENT', target: 'SHARED', isMandatory: false, reason: 'Match maintenance and vibration control' },
          { name: 'Ball Pickup Hopper / Caddy', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Drill collection efficiency' },
          { name: 'Sideline Cooling Towels & Electrolytes', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Court heat recovery' },
        ];
      } else if (sportLower.includes('volleyball')) {
        fallbackList = [
          { name: 'Regulation Match Volleyballs', quantity: 4, category: 'BALLS', target: 'SHARED', isMandatory: true, reason: 'Regulation competition volleyballs' },
          { name: 'Ball Cart with Wheels', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Team drill logistics' },
          { name: 'Antennae Set & Net Height Gauge', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Court setup and calibration' },
          { name: 'Finger Strapping Tape & Ice Packs', quantity: 1, category: 'MEDICAL', target: 'SHARED', isMandatory: true, reason: 'Spiking and blocking protection' },
        ];
      } else if (sportLower.includes('run') || sportLower.includes('track')) {
        fallbackList = [
          { name: 'Race Bib Numbers & Safety Pins (Pack of 50)', quantity: 1, category: 'APPAREL', target: 'SHARED', isMandatory: true, reason: 'Athlete timing registration' },
          { name: 'Digital Pace Stopwatch & Split Timer', quantity: 2, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Interval split recording' },
          { name: 'Electrolyte Hydration Station (15L)', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Distance hydration fueling' },
          { name: 'Blister Relief Kit & Compression Wraps', quantity: 1, category: 'MEDICAL', target: 'SHARED', isMandatory: true, reason: 'Foot care and muscle cramp management' },
        ];
      } else if (sportLower.includes('cycl') || sportLower.includes('bike')) {
        fallbackList = [
          { name: 'High-Pressure Floor Bike Pump with Gauge', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Pre-ride tire pressure check' },
          { name: 'Puncture Repair Kit & Spare Inner Tubes', quantity: 2, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Roadside mechanical repair' },
          { name: 'Multi-Tool with Chain Splitter', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'On-the-go bike adjustment' },
          { name: 'Electrolyte Carb Drink Mix (1kg Tub)', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Endurance glycogen replenishment' },
        ];
      } else if (sportLower.includes('hik') || sportLower.includes('camp')) {
        fallbackList = [
          { name: 'Topographic Trail Map & Magnetic Compass', quantity: 1, category: 'EQUIPMENT', target: 'SHARED', isMandatory: true, reason: 'Backcountry route navigation' },
          { name: 'Wilderness Trauma First Aid Kit', quantity: 1, category: 'MEDICAL', target: 'SHARED', isMandatory: true, reason: 'Emergency trail injury management' },
          { name: 'Portable Water Filtration System', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Potable drinking water supply' },
          { name: 'High-Lumen LED Headlamps & Emergency Bivvy', quantity: 2, category: 'SAFETY', target: 'SHARED', isMandatory: true, reason: 'Low-light safety and weather shelter' },
        ];
      } else {
        fallbackList = [
          { name: `${eventContext?.sport || eventContext?.title || 'Match'} Game Balls`, quantity: 3, category: 'BALLS', target: 'SHARED', isMandatory: true, reason: 'Core required match equipment' },
          { name: 'First Aid Kit & Cold Therapy Ice Packs', quantity: 1, category: 'MEDICAL', target: 'SHARED', isMandatory: true, reason: 'Player safety and pitchside injury management' },
          { name: 'Numbered Training Bibs (Set of 12)', quantity: 1, category: 'APPAREL', target: 'SHARED', isMandatory: true, reason: 'Warm-ups and tactical drills' },
          { name: 'Team Hydration Cooler (10L)', quantity: 1, category: 'HYDRATION', target: 'SHARED', isMandatory: true, reason: 'Hydration coverage for team attendance' },
        ];
      }

      setSuggestedItems(fallbackList);
      const initialSelection: Record<number, boolean> = {};
      fallbackList.forEach((_, idx) => {
        initialSelection[idx] = true;
      });
      setSelectedSuggestions(initialSelection);
    } finally {
      setIsSuggesting(false);
    }
  };

  // Handle Gemma Chat
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await api.post('/ai/gemma/chat', {
        prompt: userMsg,
        message: userMsg,
        context: {
          sport: eventContext?.sport,
          event: eventContext?.title,
          weather: eventContext?.weatherDescription,
        },
      });
      const reply = res.data?.reply || 'I am ready to assist with your equipment manifest.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Gemma AI Assistant: For outdoor sports, always verify first aid supplies, hydration stations, proper footwear studs, and backup match equipment based on current surface conditions.',
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAcceptParsed = () => {
    if (parsedItems.length === 0) return;
    onAcceptItems(parsedItems);
  };

  const handleAcceptSelectedSuggestions = () => {
    const selected = suggestedItems.filter((_, idx) => selectedSuggestions[idx]);
    if (selected.length === 0) return;
    onAcceptItems(selected);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-brand-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-brand-bg to-white border-b border-brand-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline font-bold text-base uppercase tracking-wider text-brand-text">
                  Smart Add (Natural Language Parser)
                </h2>
                <span className="px-1.5 py-0.5 text-[9px] font-headline font-bold uppercase tracking-wider bg-primary text-white rounded">
                  Gemma AI
                </span>
              </div>
              <p className="font-body text-xs text-brand-muted">
                Intelligent gear parsing, event recommendations, and preparation coaching powered by Gemma.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-muted hover:text-brand-text rounded-md hover:bg-brand-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation with sliding bar and orange active background */}
        <div ref={tabContainerRef} className="relative flex border-b border-brand-border px-6 bg-brand-bg/30 shrink-0">
          {/* Animated sliding orange bar */}
          <div
            className="absolute bottom-0 h-1 bg-[#FF4D00] rounded-t shadow-[0_2px_8px_rgba(255,77,0,0.5)] pointer-events-none z-10"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.ready ? 1 : 0,
              transition: 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease',
            }}
          />

          {tabList.map((tab, idx) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                ref={(el) => (tabRefs.current[idx] = el)}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'suggest' && suggestedItems.length === 0) {
                    handleFetchSuggestions();
                  }
                }}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-headline uppercase font-bold tracking-wider transition-all duration-300 rounded-t-md ${
                  active
                    ? 'bg-[#FF4D00]/10 text-[#FF4D00]'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-bg/50'
                }`}
              >
                <tab.Icon
                  className={`w-4 h-4 transition-transform duration-300 ${
                    active ? 'scale-110 text-[#FF4D00]' : ''
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PARSE */}
          {activeTab === 'parse' && (
            <div className="space-y-4">
              <div>
                <label className="block font-headline text-xs uppercase font-bold text-brand-text mb-1">
                  Paste Unstructured Gear Notes
                </label>
                <p className="font-body text-xs text-brand-muted mb-2">
                  Paste notes, WhatsApp messages, or gear lists. Gemma will identify item names,
                  quantities, and categories.
                </p>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setInputText(text);
                    setParsedItems(parseNaturalLanguageGearList(text));
                  }}
                  placeholder="e.g. 2 match balls, 15 orange pinnies, water cooler, 4 agility hurdles, first aid kit, 2 clipboards"
                  className="w-full border border-brand-border rounded-lg p-3 text-sm font-body focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] font-body text-brand-muted">
                  Tip: Separate items with commas, newlines, or conjunctions.
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  loading={isParsing}
                  onClick={handleParse}
                  disabled={!inputText.trim() || isParsing}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze with Gemma
                </Button>
              </div>

              {parsedItems.length > 0 && (
                <div className="mt-4 border border-brand-border rounded-lg overflow-hidden">
                  <div className="bg-brand-bg px-4 py-2 border-b border-brand-border flex items-center justify-between">
                    <span className="font-headline font-bold text-xs uppercase tracking-wider text-brand-text">
                      Parsed Draft Items ({parsedItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setParsedItems([])}
                      className="text-[11px] font-headline uppercase text-brand-muted hover:text-[#BA1A1A]"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-brand-border">
                    {parsedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-brand-bg/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-headline font-bold text-primary text-sm shrink-0">
                            {item.quantity}×
                          </span>
                          <div className="min-w-0">
                            <p className="font-headline font-bold text-xs uppercase text-brand-text truncate">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.category && (
                                <span className="text-[9px] font-headline uppercase px-1.5 py-0.2 bg-[#1A1A1A] text-white rounded">
                                  {item.category}
                                </span>
                              )}
                              {item.reason && (
                                <span className="text-[10px] font-body text-brand-muted truncate">
                                  {item.reason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setParsedItems(
                                parsedItems.map((it, i) =>
                                  i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it,
                                ),
                              )
                            }
                            className="w-6 h-6 border border-brand-border rounded flex items-center justify-center text-xs hover:border-primary"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setParsedItems(
                                parsedItems.map((it, i) =>
                                  i === idx ? { ...it, quantity: it.quantity + 1 } : it,
                                ),
                              )
                            }
                            className="w-6 h-6 border border-brand-border rounded flex items-center justify-center text-xs hover:border-primary"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setParsedItems(parsedItems.filter((_, i) => i !== idx))}
                            className="p-1 text-brand-muted hover:text-[#BA1A1A] transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUGGEST */}
          {activeTab === 'suggest' && (
            <div className="space-y-4">
              <div className="p-4 bg-brand-bg rounded-lg border border-brand-border flex items-center justify-between">
                <div>
                  <span className="font-headline text-[10px] uppercase text-brand-muted block">
                    Event Context
                  </span>
                  <p className="font-headline font-bold text-sm uppercase text-brand-text">
                    {eventContext?.sport || 'Squad'} — {eventContext?.title || 'Session'}
                  </p>
                  <p className="font-body text-xs text-brand-muted mt-0.5">
                    {eventContext?.weatherDescription
                      ? `Weather: ${eventContext.weatherDescription}`
                      : 'Standard outdoor conditions'}{' '}
                    • {eventContext?.memberCount ?? 15} Squad Members
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFetchSuggestions}
                  loading={isSuggesting}
                  className="flex items-center gap-1.5 border border-[#1A1A1A]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </Button>
              </div>

              {isSuggesting ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <LoadingSpinner size="md" />
                  <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                    Gemma is generating customized equipment recommendations...
                  </p>
                </div>
              ) : suggestedItems.length > 0 ? (
                <div className="border border-brand-border rounded-lg overflow-hidden divide-y divide-brand-border">
                  {suggestedItems.map((item, idx) => {
                    const isChecked = selectedSuggestions[idx] ?? false;
                    return (
                      <label
                        key={idx}
                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                          isChecked ? 'bg-primary/5' : 'bg-white hover:bg-brand-bg/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedSuggestions((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 text-primary rounded mt-0.5 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-headline font-bold text-sm text-brand-text">
                              {item.quantity}× {item.name}
                            </span>
                            {item.category && (
                              <span className="text-[9px] font-headline uppercase px-1.5 py-0.2 bg-[#1A1A1A] text-white rounded">
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.reason && (
                            <p className="font-body text-xs text-brand-muted mt-0.5">
                              {item.reason}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-brand-border rounded-lg">
                  <p className="font-headline text-xs uppercase text-brand-muted">
                    Click Regenerate to ask Gemma for equipment recommendations.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHAT & ADVICE */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[340px]">
              <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-brand-bg/40 rounded-lg border border-brand-border mb-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white font-body'
                          : 'bg-white border border-brand-border text-brand-text font-body shadow-xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex gap-2.5 items-center text-xs font-headline text-brand-muted">
                    <LoadingSpinner size="sm" />
                    <span>Gemma is thinking...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask Gemma about gear, weather adaptations, tournament prep..."
                  className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-xs font-body focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatLoading}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-brand-bg/30 border-t border-brand-border flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {activeTab === 'parse' && (
            <Button
              variant="urgent"
              size="sm"
              disabled={parsedItems.length === 0 || isSubmitting}
              loading={isSubmitting}
              onClick={handleAcceptParsed}
            >
              Accept & Add Items ({parsedItems.length})
            </Button>
          )}

          {activeTab === 'suggest' && (
            <Button
              variant="urgent"
              size="sm"
              disabled={
                suggestedItems.filter((_, idx) => selectedSuggestions[idx]).length === 0 ||
                isSubmitting
              }
              loading={isSubmitting}
              onClick={handleAcceptSelectedSuggestions}
            >
              Add{' '}
              {suggestedItems.filter((_, idx) => selectedSuggestions[idx]).length}{' '}
              Items to Manifest
            </Button>
          )}

          {activeTab === 'chat' && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
