"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  Filter, 
  BookOpen, 
  Clock, 
  Target, 
  Brain,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  Copy
} from 'lucide-react'
import { MathRenderer } from '@/components/math/math-renderer'
import { QuestionForm } from '@/components/questions/question-form'
import { QuestionView } from '@/components/questions/question-view'
import { QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client'

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
  options: Array<{
    id: string
    content: string
    is_correct: boolean
    order: number
    rationale?: string
  }>
  solutions: Array<{
    id: string
    content: string
    type: string
    order: number
  }>
  _count: {
    responses: number
  }
  created_at: string
  updated_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<QuestionType | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<QuestionStatus | ''>('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedChapter, setSelectedChapter] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedType) params.append('type', selectedType)
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedDifficulty) params.append('difficulty', selectedDifficulty)
      if (selectedSubject) params.append('subjectId', selectedSubject)
      if (selectedChapter) params.append('chapterId', selectedChapter)
      if (selectedTopic) params.append('topicId', selectedTopic)

      const response = await fetch(`/api/questions?${params}`)
      const data = await response.json()

      if (response.ok) {
        setQuestions(data.questions)
        setPagination(data.pagination)
      } else {
        console.error('Failed to fetch questions:', data.error)
      }
    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [pagination.page, pagination.limit])

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchQuestions()
  }

  const handleQuestionCreated = () => {
    setIsCreateDialogOpen(false)
    fetchQuestions()
  }

  const handleQuestionUpdated = () => {
    setEditingQuestion(null)
    fetchQuestions()
  }

  const handleQuestionDeleted = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchQuestions()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete question')
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question')
    }
  }

  const duplicateQuestion = async (question: Question) => {
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: question.title ? `${question.title} (Copy)` : undefined,
          content: question.content,
          type: question.type,
          difficulty: question.difficulty,
          cognitiveLevel: question.cognitive_level,
          estimatedTime: question.estimated_time,
          marks: question.marks,
          negativeMarks: question.negative_marks,
          subjectId: question.subject.id,
          chapterId: question.chapter?.id,
          topicId: question.topic?.id,
          subTopicId: question.sub_topic?.id,
          explanation: '',
          tags: [],
          partialMarking: false,
          shuffleOptions: question.shuffle_options,
          options: question.options.map(option => ({
            content: option.content,
            isCorrect: option.is_correct,
            order: option.order,
            rationale: option.rationale
          }))
        })
      })

      if (response.ok) {
        fetchQuestions()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to duplicate question')
      }
    } catch (error) {
      console.error('Error duplicating question:', error)
      alert('Failed to duplicate question')
    }
  }

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Question Bank</h1>
          <p className="text-gray-600 mt-2">Manage and organize your questions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Question</DialogTitle>
              <DialogDescription>
                Add a new question to your question bank with full math support
              </DialogDescription>
            </DialogHeader>
            <QuestionForm onSuccess={handleQuestionCreated} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as QuestionType | '')}>
              <SelectTrigger>
                <SelectValue placeholder="Question Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {Object.values(QuestionType).map(type => (
                  <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as QuestionStatus | '')}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {Object.values(QuestionStatus).map(status => (
                  <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Difficulties</SelectItem>
                <SelectItem value="1">Very Easy</SelectItem>
                <SelectItem value="2">Easy</SelectItem>
                <SelectItem value="3">Medium</SelectItem>
                <SelectItem value="4">Hard</SelectItem>
                <SelectItem value="5">Very Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch}>Apply Filters</Button>
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setSelectedType('')
              setSelectedStatus('')
              setSelectedDifficulty('')
              setSelectedSubject('')
              setSelectedChapter('')
              setSelectedTopic('')
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading questions...</div>
        ) : questions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No questions found</h3>
              <p className="text-gray-600 mb-4">Create your first question to get started</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {questions.map((question) => (
              <Card key={question.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getTypeColor(question.type)}>
                          {question.type.replace('_', ' ')}
                        </Badge>
                        <Badge className={getStatusColor(question.status)}>
                          {question.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getDifficultyColor(question.difficulty)}>
                          Level {question.difficulty}
                        </Badge>
                      </div>
                      
                      {question.title && (
                        <h3 className="text-lg font-semibold mb-2">{question.title}</h3>
                      )}
                      
                      <div className="text-gray-700 mb-3">
                        <MathRenderer content={question.content} />
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          <span>{question.subject.name}</span>
                          {question.chapter && (
                            <span> → {question.chapter.name}</span>
                          )}
                          {question.topic && (
                            <span> → {question.topic.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{question.estimated_time}s</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          <span>{question.marks} marks</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Brain className="h-4 w-4" />
                          <span>{question.cognitive_level.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingQuestion(question)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingQuestion(question)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateQuestion(question)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuestionDeleted(question.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Created by {question.created_by.name}</span>
                    <span>{question._count.responses} responses</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} questions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* View Question Dialog */}
      <Dialog open={!!viewingQuestion} onOpenChange={() => setViewingQuestion(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Question</DialogTitle>
          </DialogHeader>
          {viewingQuestion && <QuestionView question={viewingQuestion} />}
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={() => setEditingQuestion(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update question details and options
            </DialogDescription>
          </DialogHeader>
          {editingQuestion && (
            <QuestionForm 
              question={editingQuestion} 
              onSuccess={handleQuestionUpdated} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}