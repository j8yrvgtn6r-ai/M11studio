import { useState } from 'react';
import { Send, Sparkles, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: Array<{ text: string; action: string }>;
}

export function ProtocolCopilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Hello! I\'m your M11 Protocol Copilot. I can help you draft sections, check M11 compliance, identify inconsistencies, propose Schedule of Activities rows, and suggest downstream mappings. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(inputValue),
        timestamp: new Date(),
        suggestions: generateMockSuggestions(inputValue),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);

    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border-t border-border" data-testid="protocol-copilot-panel">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold text-sm">Protocol Copilot</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          M11 Compliance Assistant
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0" data-testid="protocol-copilot-scroll">
        <div className="p-3 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                </div>
              )}
              <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block rounded-lg p-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.content}
                </div>
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {message.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-2 w-full justify-start text-left"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1.5 shrink-0" />
                        <span className="flex-1">{suggestion.text}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask about M11 compliance, draft sections, check consistency..."
            className="text-sm"
          />
          <Button onClick={handleSendMessage} size="sm" disabled={!inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {['Check M11 compliance', 'Draft synopsis', 'Suggest SoA rows'].map((prompt) => (
            <Button
              key={prompt}
              variant="ghost"
              size="sm"
              onClick={() => setInputValue(prompt)}
              className="text-xs h-6 px-2"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateMockResponse(input: string): string {
  const inputLower = input.toLowerCase();

  if (inputLower.includes('compliance') || inputLower.includes('check')) {
    return 'I\'ve analyzed the current protocol for M11 compliance. Found 2 critical issues:\n\n1. Amendment Scope is required when Original Protocol Indicator is "No"\n2. Safety assessment procedures in Section 8 are incomplete\n\nWould you like me to help resolve these issues?';
  }

  if (inputLower.includes('draft') || inputLower.includes('synopsis')) {
    return 'I can help draft the protocol synopsis. Based on the current protocol data:\n\nThis is a Phase 3, randomized, double-blind, placebo-controlled study evaluating the efficacy and safety of investigational drug XYZ in patients with advanced non-small cell lung cancer.\n\nShall I expand this with objectives, endpoints, and study design details?';
  }

  if (inputLower.includes('soa') || inputLower.includes('schedule')) {
    return 'Based on Section 8.4 (Safety Assessments), I recommend adding the following rows to the Schedule of Activities:\n\n• ECG assessment (currently mentioned but not in SoA)\n• Pregnancy test (standard for Phase 3 oncology trials)\n• ECOG Performance Status\n\nWould you like me to add these?';
  }

  return 'I\'m here to help with M11 compliance, drafting sections, checking consistency, and proposing downstream mappings. Could you provide more specific details about what you\'d like assistance with?';
}

function generateMockSuggestions(input: string): Array<{ text: string; action: string }> {
  const inputLower = input.toLowerCase();

  if (inputLower.includes('compliance') || inputLower.includes('check')) {
    return [
      { text: 'Fix Amendment Scope issue', action: 'fix_amendment' },
      { text: 'Complete Safety Assessments section', action: 'complete_safety' },
    ];
  }

  if (inputLower.includes('soa') || inputLower.includes('schedule')) {
    return [
      { text: 'Add ECG to Schedule of Activities', action: 'add_ecg' },
      { text: 'Add Pregnancy Test to SoA', action: 'add_pregnancy' },
    ];
  }

  return [];
}
