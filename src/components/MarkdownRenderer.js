import React from 'react';

/**
 * Markdown renderer component for chat messages
 * @param {string} text - Text to render with markdown formatting
 */
const MarkdownRenderer = ({ text }) => {
    const renderText = () => {
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index}>{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };
    
    return <p className="text-sm whitespace-pre-wrap">{renderText()}</p>;
};

export default MarkdownRenderer;
