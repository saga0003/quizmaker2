"use client"

import { MathRenderer } from '@/components/math/math-renderer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  BookOpen, 
  Clock, 
  Target, 
  Users, 
  User,
  Calendar,
  Play,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { TestMode, TestStatus } from '@prisma/client'

interface Question {
  id: string
  title?: string
  content: string
  type: string
  difficulty: number
  cognitive_level: string
  estimated_time: number
  marks: number
  negative_marks: number
  subject: { name: string }
  chapter?: { name: string }
  topic?: { name: string }
  options: Array<{
    id: string
    content: string
    is_correct: boolean
    order: number
    rationale?: string
  }>
}

interface Section {
  id: string
  name: string
  description?: string
  order: number
  duration?: number
  marks?: number
  instructions?: string
  questions: Array<{
    id: string
    order: number
    marks: number
    negative_marks: number
    question: Question
  }>
}

interface Test {
  id: string
  title: string
  description?: string
  code?: string
  mode: TestMode
  status: TestStatus
  duration: number
  start_time?: string
  end_time?: string
  max_attempts: number
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results: boolean
  show_solutions: boolean
  allow_review: boolean
  negative_marking: any
  passing_marks?: number
  total_marks?: number
  instructions?: string
  organization: { id: string; name: string; slug: string }
  created_by: { id: string; name: string; email: string }
  template?: { id: string; name: string; type: string }
  sections: Section[]
  _count: {
    attempts: number
    questions: number
    assignments: number
  }
  created_at: string
  updated_at: string
}

interface TestViewProps {
  test: Test
}

export function TestView({ test }: TestViewProps) {
  const getModeColor = (mode: TestMode) => {
    const colors = {
      PRACTICE: 'bg-green-100 text-green-800',
      TIMED_PRACTICE: 'bg-blue-100 text-blue-800',
      PROCTORED: 'bg-red-100 text-red-800',
      CENTER_BASED: 'bg-purple-100 text-purple-800',
      HOMEWORK: 'bg-yellow-100 text-yellow-800'
    }
    return colors[mode] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status: TestStatus) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PUBLISHED: 'bg-green-100 text-green-800',
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

  const getTypeColor = (type: string) => {
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
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const calculateTotalMarks = () => {
    return test.sections.reduce((total, section) => {
      return total + section.questions.reduce((sectionTotal, testQuestion) => {
        return sectionTotal + testQuestion.marks
      }, 0)
    }, 0)
  }

  const calculateTotalDuration = () => {
    const sectionDurations = test.sections
      .map(section => section.duration)
      .filter(duration => duration !== undefined)
    
    if (sectionDurations.length > 0) {
      return sectionDurations.reduce((sum, duration) => sum + duration!, 0)
    }
    return test.duration
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getModeColor(test.mode)}>
                  {test.mode.replace('_', ' ')}
                </Badge>
                <Badge className={getStatusColor(test.status)}>
                  {test.status.replace('_', ' ')}
                </Badge>
                {test.code && (
                  <Badge variant="outline">
                    {test.code}
                  </Badge>
                )}
              </div>
              
              <CardTitle className="text-2xl">{test.title}</CardTitle>
              
              {test.description && (
                <p className="text-gray-600 mt-2">{test.description}</p>
              )}
            </div>
            
            <div className="text-right text-sm text-gray-500">
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="h-4 w-4" />
                <span>Created: {new Date(test.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Updated: {new Date(test.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Test Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Test Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">{test._count.questions}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">{calculateTotalMarks()}</div>
              <div className="text-sm text-gray-600">Total Marks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">{calculateTotalDuration()}</div>
              <div className="text-sm text-gray-600">Duration (min)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">{test._count.attempts}</div>
              <div className="text-sm text-gray-600">Attempts</div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Test Duration</div>
                  <div className="text-gray-900">{test.duration} minutes</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Passing Marks</div>
                  <div className="text-gray-900">{test.passing_marks || 0}%</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Max Attempts</div>
                  <div className="text-gray-900">{test.max_attempts}</div>
                </div>
              </div>
              
              {test.start_time && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Start Time</div>
                    <div className="text-gray-900">
                      {new Date(test.start_time).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              
              {test.end_time && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">End Time</div>
                    <div className="text-gray-900">
                      {new Date(test.end_time).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Created By</div>
                  <div className="text-gray-900">{test.created_by.name}</div>
                  <div className="text-sm text-gray-500">{test.created_by.email}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Organization</div>
                  <div className="text-gray-900">{test.organization.name}</div>
                </div>
              </div>
              
              {test.template && (
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Template</div>
                    <div className="text-gray-900">{test.template.name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Test Settings</div>
            <div className="flex flex-wrap gap-2">
              {test.shuffle_questions && <Badge variant="outline">Shuffle Questions</Badge>}
              {test.shuffle_options && <Badge variant="outline">Shuffle Options</Badge>}
              {test.show_results && <Badge variant="outline">Show Results</Badge>}
              {test.show_solutions && <Badge variant="outline">Show Solutions</Badge>}
              {test.allow_review && <Badge variant="outline">Allow Review</Badge>}
              {test.negative_marking?.enabled && (
                <Badge variant="outline">
                  Negative Marking ({test.negative_marking.value * 100}%)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      {test.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Test Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <MathRenderer content={test.instructions} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Test Sections</h3>
        
        {test.sections.map((section, sectionIndex) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {section.name}
                  </CardTitle>
                  {section.description && (
                    <p className="text-gray-600 mt-1">{section.description}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div>Section {sectionIndex + 1}</div>
                  {section.duration && <div>{section.duration} min</div>}
                  {section.marks && <div>{section.marks} marks</div>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {section.instructions && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Section Instructions:</div>
                  <div className="text-sm text-gray-600">
                    <MathRenderer content={section.instructions} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {section.questions.map((testQuestion, questionIndex) => {
                  const question = testQuestion.question
                  return (
                    <div key={testQuestion.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className={getTypeColor(question.type)}>
                            {question.type.replace('_', ' ')}
                          </Badge>
                          <Badge className={getDifficultyColor(question.difficulty)}>
                            {getDifficultyText(question.difficulty)}
                          </Badge>
                          <Badge variant="outline">
                            Q{sectionIndex + 1}.{questionIndex + 1}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {testQuestion.marks} marks
                        </div>
                      </div>

                      {question.title && (
                        <h4 className="font-medium mb-2">{question.title}</h4>
                      )}

                      <div className="text-gray-700 mb-3">
                        <MathRenderer content={question.content} />
                      </div>

                      {question.options && question.options.length > 0 && (
                        <div className="space-y-2">
                          {question.options
                            .sort((a, b) => a.order - b.order)
                            .map((option, optionIndex) => (
                              <div key={option.id} className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-1">
                                  {option.is_correct ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm">
                                    <span className="font-medium">
                                      {String.fromCharCode(65 + optionIndex)}.
                                    </span>{' '}
                                    <MathRenderer content={option.content} />
                                  </div>
                                  {option.rationale && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Rationale: <MathRenderer content={option.rationale} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                        <span>Subject: {question.subject.name}</span>
                        {question.chapter && (
                          <span>Chapter: {question.chapter.name}</span>
                        )}
                        {question.topic && (
                          <span>Topic: {question.topic.name}</span>
                        )}
                        <span>Time: {question.estimated_time}s</span>
                        <span>Cognitive: {question.cognitive_level.replace('_', ' ')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Question Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {test.sections.reduce((sum, section) => sum + section.questions.filter(q => q.question.type === 'MCQ_SINGLE').length, 0)}
              </div>
              <div className="text-xs text-gray-600">MCQ Single</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {test.sections.reduce((sum, section) => sum + section.questions.filter(q => q.question.type === 'MCQ_MULTI').length, 0)}
              </div>
              <div className="text-xs text-gray-600">MCQ Multi</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {test.sections.reduce((sum, section) => sum + section.questions.filter(q => q.question.type === 'INTEGER').length, 0)}
              </div>
              <div className="text-xs text-gray-600">Integer</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">
                {test.sections.reduce((sum, section) => sum + section.questions.filter(q => q.question.type === 'DESCRIPTIVE').length, 0)}
              </div>
              <div className="text-xs text-gray-600">Descriptive</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                {test.sections.reduce((sum, section) => sum + section.questions.filter(q => q.question.difficulty >= 4).length, 0)}
              </div>
              <div className="text-xs text-gray-600">Hard Questions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}