'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Download, FileJson, Loader2, Mic, Play, Square } from 'lucide-react';
import { WorkflowCanvas } from './WorkflowCanvas';
import { sampleWorkflow } from '@/lib/examples';
import { toN8nWorkflow } from '@/lib/n8n';
import type { WorkflowOptimizationQuestion, WorkflowSpec } from '@/lib/workflow-schema';

type GenerationResponse = {
  spec: WorkflowSpec;
  n8n: unknown;
};

type OptimizationQuestionResponse = {
  optimizationQuestion: WorkflowOptimizationQuestion;
};

type ApiErrorResponse = {
  error: string;
  details?: string[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const starterPrompt =
  'When a new support ticket arrives, classify whether it is billing or technical. If it is billing, create a human review step before sending a Slack webhook. If it is technical, prepare a troubleshooting response and send it to the helpdesk API.';

export function WorkflowBuilder() {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [optimizationQuestion, setOptimizationQuestion] = useState<WorkflowOptimizationQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [spec, setSpec] = useState<WorkflowSpec | null>(null);
  const [n8n, setN8n] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<'question' | 'workflow' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = spec ? `${spec.nodes.length} nodes` : optimizationQuestion ? 'Optimization' : 'Ready';

  const jsonPreview = useMemo(() => {
    if (!n8n) {
      return '{\n  "name": "Your generated n8n workflow will appear here"\n}';
    }

    return JSON.stringify(n8n, null, 2);
  }, [n8n]);

  async function requestOptimizationQuestion() {
    setError(null);
    setSpec(null);
    setN8n(null);
    setOptimizationQuestion(null);
    setSelectedOptionId(null);
    setIsGenerating(true);
    setGenerationStage('question');

    try {
      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createOptimizationQuestion', prompt }),
      });

      const payload = (await response.json()) as OptimizationQuestionResponse | ApiErrorResponse;

      if (!response.ok) {
        const details = 'details' in payload && payload.details ? ` ${payload.details.join(' ')}` : '';
        throw new Error(`${'error' in payload ? payload.error : 'Request failed.'}${details}`);
      }

      setOptimizationQuestion((payload as OptimizationQuestionResponse).optimizationQuestion);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create optimization question.');
    } finally {
      setIsGenerating(false);
      setGenerationStage(null);
    }
  }

  async function generateWorkflow() {
    const selectedOption = optimizationQuestion?.options.find((option) => option.id === selectedOptionId);

    if (!optimizationQuestion || !selectedOption) {
      setError('Choose an optimization priority before building the workflow.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGenerationStage('workflow');

    try {
      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateWorkflow',
          prompt,
          optimization: {
            question: optimizationQuestion.question,
            selectedOption,
          },
        }),
      });

      const payload = (await response.json()) as GenerationResponse | ApiErrorResponse;

      if (!response.ok) {
        const details = 'details' in payload && payload.details ? ` ${payload.details.join(' ')}` : '';
        throw new Error(`${'error' in payload ? payload.error : 'Request failed.'}${details}`);
      }

      setSpec((payload as GenerationResponse).spec);
      setN8n((payload as GenerationResponse).n8n);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to generate workflow.');
    } finally {
      setIsGenerating(false);
      setGenerationStage(null);
    }
  }

  function loadSample() {
    setError(null);
    setOptimizationQuestion(null);
    setSelectedOptionId(null);
    setSpec(sampleWorkflow);
    setN8n(toN8nWorkflow(sampleWorkflow));
  }

  function downloadWorkflow() {
    if (!n8n) {
      return;
    }

    const blob = new Blob([JSON.stringify(n8n, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(spec?.workflowName || 'n8n-workflow')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyJson() {
    await navigator.clipboard.writeText(jsonPreview);
  }

  function toggleListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('This browser does not expose the Web Speech API. Use the text box instead.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      updatePrompt(transcript);
    };

    recognition.onerror = (event) => {
      setError(`Voice input failed: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setError(null);
      setIsListening(true);
      recognition.start();
    }
  }

  function updatePrompt(value: string) {
    setPrompt(value);
    setOptimizationQuestion(null);
    setSelectedOptionId(null);
    setSpec(null);
    setN8n(null);
  }

  return (
    <main className="page-shell">
      <section className="control-panel">
        <div className="brand-row">
          <div>
            <h1>Voice Workflow Automation Builder</h1>
            <p>Turn a spoken automation request into a validated n8n workflow preview.</p>
          </div>
          <span className="status-pill">{statusLabel}</span>
        </div>

        <div className="prompt-area">
          <label className="prompt-label" htmlFor="workflow-prompt">
            Voice transcript or written workflow request
          </label>
          <textarea
            id="workflow-prompt"
            className="prompt-box"
            value={prompt}
            onChange={(event) => updatePrompt(event.target.value)}
          />
          <div className="button-row">
            <button
              className={`button icon-only ${isListening ? 'voice-active' : ''}`}
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            >
              {isListening ? <Square size={18} /> : <Mic size={18} />}
            </button>
            <button
              className="button primary"
              type="button"
              onClick={requestOptimizationQuestion}
              disabled={isGenerating || prompt.trim().length < 8}
            >
              {isGenerating && generationStage === 'question' ? <Loader2 size={18} /> : <Play size={18} />}
              Continue
            </button>
            <button className="button" type="button" onClick={loadSample}>
              <FileJson size={18} />
              Sample
            </button>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {optimizationQuestion ? (
          <div className="details-panel optimization-panel">
            <div className="details-header">Optimization priority</div>
            <div className="optimization-body">
              <p>{optimizationQuestion.question}</p>
              <div className="option-list" role="radiogroup" aria-label="Workflow optimization priority">
                {optimizationQuestion.options.map((option) => (
                  <label className="option-choice" key={option.id}>
                    <input
                      type="radio"
                      name="optimization-priority"
                      value={option.id}
                      checked={selectedOptionId === option.id}
                      onChange={() => setSelectedOptionId(option.id)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="button primary build-button"
                type="button"
                onClick={generateWorkflow}
                disabled={isGenerating || !selectedOptionId}
              >
                {isGenerating && generationStage === 'workflow' ? (
                  <Loader2 size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Build workflow
              </button>
            </div>
          </div>
        ) : null}

        {spec ? (
          <>
            <div className="details-panel">
              <div className="details-header">Generated workflow</div>
              <ul className="summary-list">
                <li>{spec.description}</li>
                <li>{spec.reviewRequired ? 'Human review required before activation.' : 'No human review gate requested.'}</li>
                <li>{spec.edges.length} connections prepared for export.</li>
              </ul>
            </div>

            {spec.assumptions.length > 0 ? (
              <div className="details-panel">
                <div className="details-header">Assumptions</div>
                <ul className="summary-list">
                  {spec.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {spec.warnings.length > 0 ? (
              <div className="warning">{spec.warnings.join(' ')}</div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="canvas-panel">
        <div className="canvas-toolbar">
          <div className="canvas-title">
            <h2>{spec?.workflowName || 'Workflow preview'}</h2>
            <p>Review the graph before downloading the n8n JSON file.</p>
          </div>
          <div className="button-row">
            <button className="button" type="button" onClick={copyJson} disabled={!n8n}>
              <Clipboard size={18} />
              Copy JSON
            </button>
            <button className="button primary" type="button" onClick={downloadWorkflow} disabled={!n8n}>
              <Download size={18} />
              Download
            </button>
          </div>
        </div>
        <WorkflowCanvas spec={spec} />
        <div className="json-panel">
          <pre>{jsonPreview}</pre>
        </div>
      </section>
    </main>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
