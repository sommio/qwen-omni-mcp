export const SUMMARY_PROMPTS = {
  brief: "Provide a 1-2 sentence summary of what happens in this video.",
  standard:
    "Summarize this video in 1-2 paragraphs. Include the main topic, key events or points, and the overall message.",
  detailed: `Provide a comprehensive analysis of this video:
1. Main topic/theme
2. Key events in chronological order
3. Important visual elements
4. Any speech or text content
5. Overall takeaway`,
} as const;

export type SummaryStyle = keyof typeof SUMMARY_PROMPTS;

export const SUMMARY_MAX_TOKENS: Record<SummaryStyle, number> = {
  brief: 128,
  standard: 512,
  detailed: 1024,
};

export const TEXT_EXTRACTION_PROMPT = `Extract all text content from this video:
1. Any on-screen text, titles, or captions
2. Transcribe any spoken words
3. Text from documents, slides, or signs shown
Format as a clear list with context for each piece of text.`;

export function qaPrompt(question: string): string {
  return `Answer this question about the video: ${question}

Provide a clear, direct answer based on what you can see and hear.`;
}

export function comparePrompt(comparison: string): string {
  return `Analyze the progression and changes in this video:
${comparison}

Describe:
1. The initial state/scene
2. Key changes or transitions
3. The final state/outcome
4. Notable differences between beginning and end`;
}

export const DEFAULT_COMPARE_PROMPT = "Describe how the scene changes throughout the video";
