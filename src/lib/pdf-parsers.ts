/**
 * PDF Parser Abstraction Layer
 * 
 * This module provides a unified interface for different PDF parsing libraries,
 * making it easy to swap parsers based on requirements or performance needs.
 */

import pdf from 'pdf-parse'

// Base interface that all PDF parsers must implement
export interface PDFParser {
  name: string
  description: string
  parse(buffer: Buffer): Promise<PDFParseResult>
  supportsFeatures(): PDFParserFeatures
}

export interface PDFParseResult {
  text: string
  metadata: {
    pages?: number
    title?: string
    author?: string
    creator?: string
    subject?: string
    keywords?: string
    creationDate?: Date
    modificationDate?: Date
  }
  parseTime?: number
  parserUsed: string
}

export interface PDFParserFeatures {
  extractText: boolean
  extractMetadata: boolean
  handleEncrypted: boolean
  handleImages: boolean
  preserveFormatting: boolean
  ocrCapability: boolean
}

/**
 * PDF-Parse Implementation (Current Default)
 * Fast and reliable for most PDF text extraction needs
 */
export class PDFParseParser implements PDFParser {
  name = 'pdf-parse'
  description = 'Fast PDF text extraction using pdf-parse library. Good for standard PDFs with embedded text.'

  async parse(buffer: Buffer): Promise<PDFParseResult> {
    const startTime = Date.now()
    
    try {
      const data = await pdf(buffer)
      const parseTime = Date.now() - startTime

      return {
        text: data.text || '',
        metadata: {
          pages: data.numpages || undefined,
          title: data.info?.Title || undefined,
          author: data.info?.Author || undefined,
          creator: data.info?.Creator || undefined,
          subject: data.info?.Subject || undefined,
          keywords: data.info?.Keywords || undefined,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
        },
        parseTime,
        parserUsed: this.name
      }
    } catch (error) {
      throw new Error(`PDF-Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  supportsFeatures(): PDFParserFeatures {
    return {
      extractText: true,
      extractMetadata: true,
      handleEncrypted: false,
      handleImages: false,
      preserveFormatting: false,
      ocrCapability: false
    }
  }
}

/**
 * Mock/Fallback Parser for Testing
 * Useful for testing or when PDF parsing fails
 */
export class MockPDFParser implements PDFParser {
  name = 'mock'
  description = 'Mock parser for testing purposes. Returns sample text.'

  async parse(buffer: Buffer): Promise<PDFParseResult> {
    const startTime = Date.now()
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const parseTime = Date.now() - startTime
    
    return {
      text: `Mock PDF content extracted from ${buffer.length} byte buffer. This is sample text that would normally come from a PDF parser. The content includes multiple paragraphs and sections to test chunking functionality.`,
      metadata: {
        pages: 1,
        title: 'Mock PDF Document',
        author: 'Test Author',
        creator: 'Mock Parser'
      },
      parseTime,
      parserUsed: this.name
    }
  }

  supportsFeatures(): PDFParserFeatures {
    return {
      extractText: true,
      extractMetadata: true,
      handleEncrypted: true,
      handleImages: false,
      preserveFormatting: false,
      ocrCapability: false
    }
  }
}

// Available parsers registry
const AVAILABLE_PARSERS = {
  'pdf-parse': PDFParseParser,
  'mock': MockPDFParser,
  // Future parsers can be added here:
  // 'pdfjs': PDFJSParser,
  // 'tesseract-ocr': TesseractOCRParser,
  // 'pdf-lib': PDFLibParser,
} as const

export type ParserType = keyof typeof AVAILABLE_PARSERS

/**
 * Parser Factory - Creates parser instances
 */
export class PDFParserFactory {
  static create(parserType: ParserType = 'pdf-parse'): PDFParser {
    const ParserClass = AVAILABLE_PARSERS[parserType]
    if (!ParserClass) {
      throw new Error(`Parser '${parserType}' not found. Available parsers: ${Object.keys(AVAILABLE_PARSERS).join(', ')}`)
    }
    return new ParserClass()
  }

  static getAvailableParsers(): Array<{name: ParserType, description: string, features: PDFParserFeatures}> {
    return Object.entries(AVAILABLE_PARSERS).map(([name, ParserClass]) => {
      const instance = new ParserClass()
      return {
        name: name as ParserType,
        description: instance.description,
        features: instance.supportsFeatures()
      }
    })
  }

  static getBestParser(requirements?: Partial<PDFParserFeatures>): ParserType {
    if (!requirements) return 'pdf-parse' // Default

    const parsers = this.getAvailableParsers()
    
    // Find first parser that meets all requirements
    for (const parser of parsers) {
      const meets = Object.entries(requirements).every(([feature, required]) => {
        if (!required) return true
        return parser.features[feature as keyof PDFParserFeatures]
      })
      
      if (meets) return parser.name
    }

    // Fallback to default
    return 'pdf-parse'
  }
}

/**
 * High-level PDF parsing function with automatic parser selection
 */
export async function parsePDF(
  buffer: Buffer, 
  options?: {
    parser?: ParserType
    fallbackToMock?: boolean
    requirements?: Partial<PDFParserFeatures>
  }
): Promise<PDFParseResult> {
  const { 
    parser = options?.requirements ? PDFParserFactory.getBestParser(options.requirements) : 'pdf-parse',
    fallbackToMock = false 
  } = options || {}

  try {
    console.log(`🔧 Using PDF parser: ${parser}`)
    const pdfParser = PDFParserFactory.create(parser)
    const result = await pdfParser.parse(buffer)
    
    console.log(`✅ PDF parsed successfully with ${parser} in ${result.parseTime}ms`)
    console.log(`📄 Extracted ${result.text.length} characters from ${result.metadata.pages || 'unknown'} pages`)
    
    return result
  } catch (error) {
    console.error(`❌ PDF parsing failed with ${parser}:`, error)
    
    if (fallbackToMock && parser !== 'mock') {
      console.log('🔄 Falling back to mock parser...')
      return parsePDF(buffer, { parser: 'mock' })
    }
    
    throw error
  }
}

// Export default parser for backward compatibility
export const defaultPDFParser = PDFParserFactory.create('pdf-parse') 