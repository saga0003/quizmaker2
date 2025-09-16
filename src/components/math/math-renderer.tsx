"use client"

import React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  content: string
  displayMode?: boolean
  className?: string
}

export const MathRenderer: React.FC<MathRendererProps> = ({ 
  content, 
  displayMode = false,
  className = "" 
}) => {
  const processMathContent = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = []
    let lastIndex = 0
    let currentIndex = 0

    // Process both inline math $...$ and display math $$...$$
    const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g
    let match

    while ((match = regex.exec(text)) !== null) {
      // Add text before the math expression
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index)
        if (textBefore.trim()) {
          elements.push(
            <span key={`text-${currentIndex++}`}>
              {textBefore}
            </span>
          )
        }
      }

      const mathExpression = match[0]
      let mathContent = mathExpression
      let isDisplayMode = false

      // Determine the type of math expression and extract content
      if (mathExpression.startsWith('$$') && mathExpression.endsWith('$$')) {
        mathContent = mathExpression.slice(2, -2)
        isDisplayMode = true
      } else if (mathExpression.startsWith('$') && mathExpression.endsWith('$')) {
        mathContent = mathExpression.slice(1, -1)
        isDisplayMode = false
      } else if (mathExpression.startsWith('\\[') && mathExpression.endsWith('\\]')) {
        mathContent = mathExpression.slice(2, -2)
        isDisplayMode = true
      } else if (mathExpression.startsWith('\\(') && mathExpression.endsWith('\\)')) {
        mathContent = mathExpression.slice(2, -2)
        isDisplayMode = false
      }

      try {
        const html = katex.renderToString(mathContent.trim(), {
          displayMode: isDisplayMode,
          throwOnError: false,
          trust: true,
          output: 'html'
        })
        
        elements.push(
          <span 
            key={`math-${currentIndex++}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={isDisplayMode ? 'block my-4 text-center' : 'inline'}
          />
        )
      } catch (error) {
        // Fallback to plain text if math rendering fails
        elements.push(
          <span key={`math-error-${currentIndex++}`} className="text-red-500">
            {mathExpression}
          </span>
        )
      }

      lastIndex = match.index + match.length
    }

    // Add remaining text after the last math expression
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText.trim()) {
        elements.push(
          <span key={`text-${currentIndex++}`}>
            {remainingText}
          </span>
        )
      }
    }

    return elements
  }

  return (
    <div className={`math-content ${className}`}>
      {processMathContent(content)}
    </div>
  )
}

interface MathDisplayProps {
  formula: string
  displayMode?: boolean
  className?: string
}

export const MathDisplay: React.FC<MathDisplayProps> = ({ 
  formula, 
  displayMode = false,
  className = "" 
}) => {
  try {
    const html = katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      trust: true,
      output: 'html'
    })

    return (
      <span 
        dangerouslySetInnerHTML={{ __html: html }}
        className={`${displayMode ? 'block my-4 text-center' : 'inline'} ${className}`}
      />
    )
  } catch (error) {
    return (
      <span className={`text-red-500 ${className}`}>
        {displayMode ? `$$${formula}$$` : `$${formula}$`}
      </span>
    )
  }
}

// Utility function to check if content contains math expressions
export const containsMath = (text: string): boolean => {
  return /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/.test(text)
}

// Utility function to extract math expressions from text
export const extractMathExpressions = (text: string): string[] => {
  const matches = text.match(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g)
  return matches || []
}