"use client"

import { MathRenderer } from '@/components/math/math-renderer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  BookOpen, 
  Clock, 
  Target, 
  Brain, 
  User,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client'

interface Option {
  id: string
  content: string
  is_correct: boolean
  order: number
  rationale?: string
}

interface Solution {
  id: string
  content: string
  type: string
  order: number
}

interface Question {
  id: string
  title?: string
  content: string
  type: QuestionType
  status: QuestionStatus
  difficulty: number
  cognitive_level: CognitiveLevel
  estimated_time: number
  marks: number
  negative_marks: number
  subject: { id: string; name: string }
  chapter?: { id: string; name: string }
  topic?: { id: string; name: string }
  sub_topic?: { id: string; name: string }
  created_by: { id: string; name: string; email: string }
  reviewed_by?: { id: string; name: string; email: string }
  options: Option[]
  solutions: Solution[]
  explanation?: string
  past_exam_mapping?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

interface QuestionViewProps {
  question: Question
}

export function QuestionView({ question }: QuestionViewProps) {
  const getTypeColor = (type: QuestionType) => {
    const colors = {
      MCQ_SINGLE: 'bg-blue-100 text-blue-800',
      MCQ_MULTI: 'bg-purple-100 text-purple-800',
      INTEGER: 'bg-green-100 text-green-800',
      NUMERIC_RANGE: 'bg-yellow-100 text-yellow-800',
      ASSERTION_REASON: 'bg-red-100 text-red-800',
      MATRIX_MATCH: 'bg-indigo-100 text-indigo-800',
      FILL_IN_BLANK: 'bg-orange-100 text-orange-800',
      ORDERING: 'bg-pink-100 text-pink-800',
      DESCRIPTIVE: 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status: QuestionStatus) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      REVIEWED: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getDifficultyColor = (difficulty: number) => {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800'
    }
    return colors[difficulty as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getDifficultyText = (difficulty: number) => {
    const texts = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    }
    return texts[difficulty as keyof typeof texts] || 'Unknown'
  }

  const showOptions = () => {
    return [
      QuestionType.MCQ_SINGLE,
      QuestionType.MCQ_MULTI,
      QuestionType.MATRIX_MATCH
    ].includes(question.type)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getTypeColor(question.type)}>
                  {question.type.replace('_', ' ')}
                </Badge>
                <Badge className={getStatusColor(question.status)}>
                  {question.status.replace('_', ' ')}
                </Badge>
                <Badge className={getDifficultyColor(question.difficulty)}>
                  {getDifficultyText(question.difficulty)}
                </Badge>
              </div>
              
              {question.title && (
                <CardTitle className="text-2xl">{question.title}</CardTitle>
              )}
            </div>
            
            <div className="text-right text-sm text-gray-500">
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="h-4 w-4" />
                <span>Created: {new Date(question.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Updated: {new Date(question.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Question Content */}
      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <MathRenderer content={question.content} />
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      {showOptions() && question.options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Answer Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {question.options
                .sort((a, b) => a.order - b.order)
                .map((option, index) => (
                  <div key={option.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {option.is_correct ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">
                            Option {String.fromCharCode(65 + index)}
                          </span>
                          {option.is_correct && (
                            <Badge className="bg-green-100 text-green-800">
                              Correct Answer
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-700">
                          <MathRenderer content={option.content} />
                        </div>
                        {option.rationale && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-md">
                            <div className="text-sm font-medium text-gray-700 mb-1">
                              Rationale:
                            </div>
                            <div className="text-sm text-gray-600">
                              <MathRenderer content={option.rationale} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Explanation */}
      {question.explanation && (
        <Card>
          <CardHeader>
            <CardTitle>Explanation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <MathRenderer content={question.explanation} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Solutions */}
      {question.solutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Solutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {question.solutions
                .sort((a, b) => a.order - b.order)
                .map((solution) => (
                  <div key={solution.id} className="border rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Solution ({solution.type}):
                    </div>
                    <div className="text-gray-700">
                      <MathRenderer content={solution.content} />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Subject</div>
                  <div className="text-gray-900">{question.subject.name}</div>
                </div>
              </div>
              
              {question.chapter && (
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Chapter</div>
                    <div className="text-gray-900">{question.chapter.name}</div>
                  </div>
                </div>
              )}
              
              {question.topic && (
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Topic</div>
                    <div className="text-gray-900">{question.topic.name}</div>
                  </div>
                </div>
              )}
              
              {question.sub_topic && (
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Sub-topic</div>
                    <div className="text-gray-900">{question.sub_topic.name}</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Estimated Time</div>
                  <div className="text-gray-900">{question.estimated_time} seconds</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Marks</div>
                  <div className="text-gray-900">{question.marks} marks</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Negative Marks</div>
                  <div className="text-gray-900">{question.negative_marks} marks</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Cognitive Level</div>
                  <div className="text-gray-900">{question.cognitive_level.replace('_', ' ')}</div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm font-medium text-gray-700">Created By</div>
                <div className="text-gray-900">{question.created_by.name} ({question.created_by.email})</div>
              </div>
            </div>
            
            {question.reviewed_by && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Reviewed By</div>
                  <div className="text-gray-900">{question.reviewed_by.name} ({question.reviewed_by.email})</div>
                </div>
              </div>
            )}
            
            {question.past_exam_mapping && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Past Exam Mapping</div>
                  <div className="text-gray-900">{question.past_exam_mapping}</div>
                </div>
              </div>
            )}
            
            {question.tags && question.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 text-gray-400 mt-0.5">#</div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Tags</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {question.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}