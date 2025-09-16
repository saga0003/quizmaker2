// Math utilities and constants for the quiz platform

export const MATH_CONSTANTS = {
  // Greek letters
  ALPHA: '\\alpha',
  BETA: '\\beta',
  GAMMA: '\\gamma',
  DELTA: '\\delta',
  EPSILON: '\\epsilon',
  ZETA: '\\zeta',
  ETA: '\\eta',
  THETA: '\\theta',
  IOTA: '\\iota',
  KAPPA: '\\kappa',
  LAMBDA: '\\lambda',
  MU: '\\mu',
  NU: '\\nu',
  XI: '\\xi',
  OMICRON: '\\omicron',
  PI: '\\pi',
  RHO: '\\rho',
  SIGMA: '\\sigma',
  TAU: '\\tau',
  UPSILON: '\\upsilon',
  PHI: '\\phi',
  CHI: '\\chi',
  PSI: '\\psi',
  OMEGA: '\\omega',

  // Mathematical symbols
  INFINITY: '\\infty',
  PARTIAL: '\\partial',
  NABLA: '\\nabla',
  SUM: '\\sum',
  PRODUCT: '\\prod',
  INTEGRAL: '\\int',
  CONTINUUM: '\\mathbb{R}',
  NATURALS: '\\mathbb{N}',
  INTEGERS: '\\mathbb{Z}',
  RATIONALS: '\\mathbb{Q}',
  COMPLEX: '\\mathbb{C}',
} as const

export const MATH_TEMPLATES = {
  // Algebra templates
  QUADRATIC_FORMULA: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  QUADRATIC_EQUATION: 'ax^2 + bx + c = 0',
  LINEAR_EQUATION: 'ax + b = 0',
  SYSTEM_EQUATIONS: '\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}',
  
  // Calculus templates
  DERIVATIVE: '\\frac{d}{dx}[f(x)]',
  PARTIAL_DERIVATIVE: '\\frac{\\partial f}{\\partial x}',
  SECOND_DERIVATIVE: '\\frac{d^2}{dx^2}[f(x)]',
  DEFINITE_INTEGRAL: '\\int_{a}^{b} f(x) dx',
  INDEFINITE_INTEGRAL: '\\int f(x) dx',
  LIMIT: '\\lim_{x \\to a} f(x)',
  LIMIT_INFINITY: '\\lim_{x \\to \\infty} f(x)',
  
  // Trigonometry templates
  PYTHAGOREAN: '\\sin^2\\theta + \\cos^2\\theta = 1',
  SIN_ADDITION: '\\sin(a + b) = \\sin a\\cos b + \\cos a\\sin b',
  COS_ADDITION: '\\cos(a + b) = \\cos a\\cos b - \\sin a\\sin b',
  TAN_ADDITION: '\\tan(a + b) = \\frac{\\tan a + \\tan b}{1 - \\tan a\\tan b}',
  
  // Statistics templates
  MEAN: '\\bar{x} = \\frac{\\sum_{i=1}^{n} x_i}{n}',
  VARIANCE: '\\sigma^2 = \\frac{\\sum_{i=1}^{n} (x_i - \\bar{x})^2}{n}',
  STANDARD_DEVIATION: '\\sigma = \\sqrt{\\frac{\\sum_{i=1}^{n} (x_i - \\bar{x})^2}{n}}',
  NORMAL_DISTRIBUTION: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}(\\frac{x-\\mu}{\\sigma})^2}',
  
  // Matrix templates
  MATRIX_2X2: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
  MATRIX_DETERMINANT_2X2: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc',
  MATRIX_MULTIPLICATION: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} e & f \\\\ g & h \\end{pmatrix}',
  
  // Set theory templates
  UNION: 'A \\cup B',
  INTERSECTION: 'A \\cap B',
  SUBSET: 'A \\subseteq B',
  ELEMENT_OF: 'x \\in A',
  NOT_ELEMENT_OF: 'x \\notin A',
  
  // Logic templates
  IMPLIES: 'P \\implies Q',
  EQUIVALENT: 'P \\iff Q',
  AND: 'P \\land Q',
  OR: 'P \\lor Q',
  NOT: '\\neg P',
  
  // Complex numbers
  COMPLEX_NUMBER: 'z = a + bi',
  COMPLEX_CONJUGATE: '\\bar{z} = a - bi',
  EULER_FORMULA: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta',
} as const

export const MATH_FORMATTING = {
  // Text formatting
  BOLD: '\\textbf{}',
  ITALIC: '\\textit{}',
  MONOSPACE: '\\texttt{}',
  
  // Spacing
  SMALL_SPACE: '\\,',
  MEDIUM_SPACE: '\\:',
  LARGE_SPACE: '\\;',
  QUAD_SPACE: '\\quad',
  DOUBLE_QUAD_SPACE: '\\qquad',
  
  // Brackets and delimiters
  PARENTHESES: '\\left( \\right)',
  BRACKETS: '\\left[ \\right]',
  BRACES: '\\left\\{ \\right\\}',
  ANGLES: '\\left\\langle \\right\\rangle',
  ABSOLUTE: '\\left| \\right|',
  NORM: '\\left\\| \\right\\|',
  
  // Alignment
  ALIGN_START: '&',
  ALIGN_NEWLINE: '\\\\',
  ALIGN_CENTER: '\\begin{center} \\end{center}',
  ALIGN_LEFT: '\\begin{flushleft} \\end{flushleft}',
  ALIGN_RIGHT: '\\begin{flushright} \\end{flushright}',
} as const

// Utility functions for math content processing
export const MathUtils = {
  /**
   * Clean math content from Word/Google Docs
   */
  cleanMathContent: (text: string): string => {
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/''/g, '"') // Fix smart quotes
      .replace(/''/g, '"')
      .replace(/`/g, "'")
      .replace(/–/g, '-') // Fix en-dash
      .replace(/—/g, '--') // Fix em-dash
      .replace(/…/g, '...') // Fix ellipsis
      .replace(/×/g, '\\times') // Replace multiplication symbol
      .replace(/÷/g, '\\div') // Replace division symbol
      .replace(/±/g, '\\pm') // Replace plus-minus
      .replace(/≤/g, '\\leq') // Replace less than or equal
      .replace(/≥/g, '\\geq') // Replace greater than or equal
      .replace(/≠/g, '\\neq') // Replace not equal
      .replace(/≈/g, '\\approx') // Replace approximately equal
      .replace(/∞/g, '\\infty') // Replace infinity
      .replace(/∑/g, '\\sum') // Replace summation
      .replace(/∏/g, '\\prod') // Replace product
      .replace(/∫/g, '\\int') // Replace integral
      .replace(/∂/g, '\\partial') // Replace partial derivative
      .replace(/√/g, '\\sqrt{}') // Replace square root
      .replace(/²/g, '^2') // Replace superscript 2
      .replace(/³/g, '^3') // Replace superscript 3
  },

  /**
   * Extract plain text from LaTeX content
   */
  extractPlainText: (latex: string): string => {
    return latex
      .replace(/\$.*?\$/g, '') // Remove inline math
      .replace(/\$\$.*?\$\$/g, '') // Remove display math
      .replace(/\\[a-zA-Z]+\{.*?\}/g, '') // Remove LaTeX commands
      .replace(/\\[a-zA-Z]+/g, '') // Remove simple LaTeX commands
      .replace(/[{}[\]]/g, '') // Remove remaining braces and brackets
      .trim()
  },

  /**
   * Check if LaTeX syntax is valid (basic validation)
   */
  validateLatex: (latex: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    // Check for balanced braces
    let braceCount = 0
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '{') braceCount++
      if (latex[i] === '}') braceCount--
      if (braceCount < 0) {
        errors.push('Unmatched closing brace')
        break
      }
    }
    if (braceCount > 0) {
      errors.push('Unmatched opening brace')
    }

    // Check for balanced brackets
    let bracketCount = 0
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '[') bracketCount++
      if (latex[i] === ']') bracketCount--
      if (bracketCount < 0) {
        errors.push('Unmatched closing bracket')
        break
      }
    }
    if (bracketCount > 0) {
      errors.push('Unmatched opening bracket')
    }

    // Check for balanced parentheses
    let parenCount = 0
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '(') parenCount++
      if (latex[i] === ')') parenCount--
      if (parenCount < 0) {
        errors.push('Unmatched closing parenthesis')
        break
      }
    }
    if (parenCount > 0) {
      errors.push('Unmatched opening parenthesis')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  /**
   * Format math content for display
   */
  formatForDisplay: (content: string): string => {
    return content
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim()
  },

  /**
   * Generate a unique ID for math expressions
   */
  generateMathId: (): string => {
    return `math_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export commonly used math patterns
export const MATH_PATTERNS = {
  // Number patterns
  INTEGER: /^-?\d+$/,
  DECIMAL: /^-?\d*\.\d+$/,
  SCIENTIFIC: /^-?\d+(\.\d+)?[eE][+-]?\d+$/,
  FRACTION: /^\d+\/\d+$/,
  
  // Math expression patterns
  LATEX_INLINE: /\$.*?\$/,
  LATEX_DISPLAY: /\$\$.*?\$\$/,
  LATEX_ENVIRONMENT: /\\begin\{.*?\}.*?\\end\{.*?\}/,
  
  // Equation patterns
  EQUATION: /^[^=]+=[^=]+$/,
  INEQUALITY: /[<>≤≥]/,
  
  // Function patterns
  FUNCTION: /^[a-zA-Z_]+\s*\(/,
  TRIGONOMETRIC: /sin|cos|tan|csc|sec|cot/,
  LOGARITHMIC: /log|ln/,
  EXPONENTIAL: /exp|e\^/,
} as const