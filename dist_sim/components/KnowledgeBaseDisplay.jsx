// components/KnowledgeBaseDisplay.tsx
'use client';
import React from 'react';
import DOMPurify from 'isomorphic-dompurify'; // Import DOMPurify
export function KnowledgeBaseDisplay({ answer }) {
    if (!answer || !answer.answer) {
        return null; // Don't render if no answer provided
    }
    // Basic HTML sanitization might be needed if answer contains HTML
    // For now, rendering raw text or using dangerouslySetInnerHTML with sanitization
    return (<div className="knowledge-base-container border-t border-border-light dark:border-border-dark pt-3 mt-3">
      {answer.question_matched && (<h3 className="text-md font-semibold mb-1">From our FAQ: {answer.question_matched}</h3>)}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Knowledge base answer will appear here once provided by the AI.</p> {/* Added placeholder text */}
      <div className="text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(answer.answer) }}/> {/* Sanitize answer */}
      {answer.source_url && (<p className="mt-2 text-xs">
          <a href={answer.source_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-300 hover:underline">
            Learn More
          </a>
        </p>)}
    </div>);
}
