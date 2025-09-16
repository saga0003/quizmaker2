"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MathDisplay, MathRenderer } from './math-renderer'
import { 
  Calculator, 
  Square, 
  Minus, 
  Divide, 
  Superscript, 
  Subscript,
  Sigma,
  Braces,
  Infinity,
  Pi,
  Brackets,
  Hash
} from 'lucide-react'

interface MathEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const MathEditor: React.FC<MathEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter your text with LaTeX equations like $x^2 + y^2 = z^2$",
  className = ""
}) => {
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mathSymbols = [
    { symbol: '^', label: 'Superscript', icon: Superscript },
    { symbol: '_', label: 'Subscript', icon: Subscript },
    { symbol: '\\frac{}{}', label: 'Fraction', icon: Divide },
    { symbol: '\\sqrt{}', label: 'Square Root', icon: Calculator },
    { symbol: '\\sum', label: 'Sum', icon: Sigma },
    { symbol: '\\int', label: 'Integral', icon: Braces },
    { symbol: '\\infty', label: 'Infinity', icon: Infinity },
    { symbol: '\\pi', label: 'Pi', icon: Pi },
    { symbol: '()', label: 'Parentheses', icon: Brackets },
    { symbol: '|{}|', label: 'Absolute', icon: Hash },
    { symbol: 'x^2', label: 'Squared', icon: Square },
    { symbol: '\\alpha', label: 'Alpha', icon: Calculator },
  ]

  const insertSymbol = (symbol: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = value
    const before = text.substring(0, start)
    const after = text.substring(end)

    // Handle special cases for templates
    let insertion = symbol
    let cursorOffset = symbol.length

    if (symbol === '\\frac{}{}') {
      insertion = '\\frac{}{}'
      cursorOffset = 6 // Position between first {}
    } else if (symbol === '\\sqrt{}') {
      insertion = '\\sqrt{}'
      cursorOffset = 6 // Position inside {}
    } else if (symbol === '|{}|') {
      insertion = '|{}|'
      cursorOffset = 2 // Position inside {}
    }

    const newValue = before + insertion + after
    onChange(newValue)

    // Set cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset)
    }, 0)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    
    // Clean up common Word/Google Docs math formats
    const cleanedText = pastedText
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/''/g, '"') // Fix smart quotes
      .replace(/''/g, '"')
      .replace(/`/g, "'")
      .replace(/–/g, '-') // Fix en-dash
      .replace(/—/g, '--') // Fix em-dash
      .replace(/…/g, '...') // Fix ellipsis

    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = value
    const before = text.substring(0, start)
    const after = text.substring(end)

    onChange(before + cleanedText + after)
  }

  const commonLatexTemplates = [
    { template: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$', description: 'Quadratic Formula' },
    { template: '$E = mc^2$', description: 'Einstein\'s Equation' },
    { template: '$\\int_{a}^{b} f(x) dx$', description: 'Definite Integral' },
    { template: '$\\sum_{i=1}^{n} x_i$', description: 'Summation' },
    { template: '$\\lim_{x \\to \\infty} f(x)$', description: 'Limit' },
    { template: '$\\frac{d}{dx}[f(x)]$', description: 'Derivative' },
  ]

  return (
    <div className={`math-editor ${className}`}>
      <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'edit' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="edit" className="space-y-4">
          {/* Math Symbol Toolbar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Math Symbols</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {mathSymbols.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(item.symbol)}
                      className="p-2 h-8"
                      title={item.label}
                    >
                      <Icon className="h-3 w-3" />
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* LaTeX Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Common Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {commonLatexTemplates.map((template, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto p-2"
                    onClick={() => onChange(value + '\n' + template.template)}
                  >
                    <div className="text-xs">
                      <div className="font-medium">{template.description}</div>
                      <div className="text-gray-500 font-mono text-xs">
                        {template.template}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Text Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Content (supports LaTeX: $inline$ and $$display$$)
            </label>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              placeholder={placeholder}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="text-xs text-gray-500">
              Tip: Paste equations from Word/Google Docs - they will be automatically cleaned up
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded p-4 min-h-[200px] bg-white">
                {value ? (
                  <MathRenderer content={value} />
                ) : (
                  <div className="text-gray-400 text-center">
                    No content to preview
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}