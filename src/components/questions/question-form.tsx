"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MathEditor } from '@/components/math/math-editor'
import { MathRenderer } from '@/components/math/math-renderer'
import { QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client'

interface Option {
  id: string
  content: string
  isCorrect: boolean
  order: number
  rationale?: string
}

interface Subject {
  id: string
  name: string
}

interface Chapter {
  id: string
  name: string
}

interface Topic {
  id: string
  name: string
}

interface SubTopic {
  id: string
  name: string
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
  subject_id: string
  chapter_id?: string
  topic_id?: string
  sub_topic_id?: string
  explanation?: string
  past_exam_mapping?: string
  tags?: string[]
  partial_marking: boolean
  shuffle_options: boolean
  options: Option[]
}

interface QuestionFormProps {
  question?: Question
  onSuccess: () => void
}

export function QuestionForm({ question, onSuccess }: QuestionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: QuestionType.MCQ_SINGLE,
    status: QuestionStatus.DRAFT,
    difficulty: 3,
    cognitiveLevel: CognitiveLevel.RECALL,
    estimatedTime: 60,
    marks: 1,
    negativeMarks: 0,
    subjectId: '',
    chapterId: '',
    topicId: '',
    subTopicId: '',
    explanation: '',
    pastExamMapping: '',
    tags: '',
    partialMarking: false,
    shuffleOptions: true
  })

  const [options, setOptions] = useState<Option[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [subTopics, setSubTopics] = useState<SubTopic[]>([])
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    if (question) {
      setFormData({
        title: question.title || '',
        content: question.content,
        type: question.type,
        status: question.status,
        difficulty: question.difficulty,
        cognitiveLevel: question.cognitive_level,
        estimatedTime: question.estimated_time,
        marks: question.marks,
        negativeMarks: question.negative_marks,
        subjectId: question.subject_id,
        chapterId: question.chapter_id || '',
        topicId: question.topic_id || '',
        subTopicId: question.sub_topic_id || '',
        explanation: question.explanation || '',
        pastExamMapping: question.past_exam_mapping || '',
        tags: question.tags?.join(', ') || '',
        partialMarking: question.partial_marking,
        shuffleOptions: question.shuffle_options
      })
      setOptions(question.options)
    }

    // Load subjects (using a default organization for now)
    loadSubjects()
  }, [question])

  useEffect(() => {
    if (formData.subjectId) {
      loadChapters(formData.subjectId)
    } else {
      setChapters([])
      setTopics([])
      setSubTopics([])
      setFormData(prev => ({ ...prev, chapterId: '', topicId: '', subTopicId: '' }))
    }
  }, [formData.subjectId])

  useEffect(() => {
    if (formData.chapterId) {
      loadTopics(formData.chapterId)
    } else {
      setTopics([])
      setSubTopics([])
      setFormData(prev => ({ ...prev, topicId: '', subTopicId: '' }))
    }
  }, [formData.chapterId])

  useEffect(() => {
    if (formData.topicId) {
      loadSubTopics(formData.topicId)
    } else {
      setSubTopics([])
      setFormData(prev => ({ ...prev, subTopicId: '' }))
    }
  }, [formData.topicId])

  const loadSubjects = async () => {
    try {
      const response = await fetch('/api/taxonomy?type=subjects&organizationId=default-org')
      if (response.ok) {
        const data = await response.json()
        setSubjects(data)
      }
    } catch (error) {
      console.error('Error loading subjects:', error)
    }
  }

  const loadChapters = async (subjectId: string) => {
    try {
      const response = await fetch(`/api/taxonomy?type=chapters&subjectId=${subjectId}`)
      if (response.ok) {
        const data = await response.json()
        setChapters(data)
      }
    } catch (error) {
      console.error('Error loading chapters:', error)
    }
  }

  const loadTopics = async (chapterId: string) => {
    try {
      const response = await fetch(`/api/taxonomy?type=topics&chapterId=${chapterId}`)
      if (response.ok) {
        const data = await response.json()
        setTopics(data)
      }
    } catch (error) {
      console.error('Error loading topics:', error)
    }
  }

  const loadSubTopics = async (topicId: string) => {
    try {
      const response = await fetch(`/api/taxonomy?type=subtopics&topicId=${topicId}`)
      if (response.ok) {
        const data = await response.json()
        setSubTopics(data)
      }
    } catch (error) {
      console.error('Error loading subtopics:', error)
    }
  }

  const addOption = () => {
    const newOption: Option = {
      id: Date.now().toString(),
      content: '',
      isCorrect: false,
      order: options.length
    }
    setOptions([...options, newOption])
  }

  const updateOption = (id: string, field: keyof Option, value: any) => {
    setOptions(options.map(option => 
      option.id === id ? { ...option, [field]: value } : option
    ))
  }

  const removeOption = (id: string) => {
    setOptions(options.filter(option => option.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = question ? `/api/questions/${question.id}` : '/api/questions'
      const method = question ? 'PUT' : 'POST'

      const payload = {
        title: formData.title || undefined,
        content: formData.content,
        type: formData.type,
        difficulty: formData.difficulty,
        cognitiveLevel: formData.cognitiveLevel,
        estimatedTime: formData.estimatedTime,
        marks: formData.marks,
        negativeMarks: formData.negativeMarks,
        subjectId: formData.subjectId,
        chapterId: formData.chapterId || undefined,
        topicId: formData.topicId || undefined,
        subTopicId: formData.subTopicId || undefined,
        explanation: formData.explanation || undefined,
        pastExamMapping: formData.pastExamMapping || undefined,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        partialMarking: formData.partialMarking,
        shuffleOptions: formData.shuffleOptions,
        options: options.map(option => ({
          content: option.content,
          isCorrect: option.isCorrect,
          order: option.order,
          rationale: option.rationale
        }))
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save question')
      }
    } catch (error) {
      console.error('Error saving question:', error)
      alert('Failed to save question')
    } finally {
      setLoading(false)
    }
  }

  const showOptions = () => {
    return [
      QuestionType.MCQ_SINGLE,
      QuestionType.MCQ_MULTI,
      QuestionType.MATRIX_MATCH
    ].includes(formData.type)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set the basic properties of your question</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title (Optional)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter question title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Question Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as QuestionType }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(QuestionType).map(type => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as QuestionStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(QuestionStatus).map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="difficulty">Difficulty (1-5)</Label>
                  <Select value={formData.difficulty.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Very Easy</SelectItem>
                      <SelectItem value="2">2 - Easy</SelectItem>
                      <SelectItem value="3">3 - Medium</SelectItem>
                      <SelectItem value="4">4 - Hard</SelectItem>
                      <SelectItem value="5">5 - Very Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cognitiveLevel">Cognitive Level</Label>
                  <Select value={formData.cognitiveLevel} onValueChange={(value) => setFormData(prev => ({ ...prev, cognitiveLevel: value as CognitiveLevel }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CognitiveLevel).map(level => (
                        <SelectItem key={level} value={level}>
                          {level.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estimatedTime">Estimated Time (seconds)</Label>
                  <Input
                    id="estimatedTime"
                    type="number"
                    value={formData.estimatedTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) }))}
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="marks">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    step="0.5"
                    value={formData.marks}
                    onChange={(e) => setFormData(prev => ({ ...prev, marks: parseFloat(e.target.value) }))}
                    min="0"
                  />
                </div>

                <div>
                  <Label htmlFor="negativeMarks">Negative Marks</Label>
                  <Input
                    id="negativeMarks"
                    type="number"
                    step="0.5"
                    value={formData.negativeMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, negativeMarks: parseFloat(e.target.value) }))}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={formData.subjectId} onValueChange={(value) => setFormData(prev => ({ ...prev, subjectId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {chapters.length > 0 && (
                  <div>
                    <Label htmlFor="chapter">Chapter (Optional)</Label>
                    <Select value={formData.chapterId} onValueChange={(value) => setFormData(prev => ({ ...prev, chapterId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Chapter</SelectItem>
                        {chapters.map(chapter => (
                          <SelectItem key={chapter.id} value={chapter.id}>
                            {chapter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {topics.length > 0 && (
                  <div>
                    <Label htmlFor="topic">Topic (Optional)</Label>
                    <Select value={formData.topicId} onValueChange={(value) => setFormData(prev => ({ ...prev, topicId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Topic</SelectItem>
                        {topics.map(topic => (
                          <SelectItem key={topic.id} value={topic.id}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {subTopics.length > 0 && (
                  <div>
                    <Label htmlFor="subTopic">Sub-topic (Optional)</Label>
                    <Select value={formData.subTopicId} onValueChange={(value) => setFormData(prev => ({ ...prev, subTopicId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Sub-topic</SelectItem>
                        {subTopics.map(subTopic => (
                          <SelectItem key={subTopic.id} value={subTopic.id}>
                            {subTopic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Content</CardTitle>
              <CardDescription>Write your question with full math equation support</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={previewMode ? 'preview' : 'edit'} onValueChange={(value) => setPreviewMode(value === 'preview')}>
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit">
                  <MathEditor
                    value={formData.content}
                    onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                    placeholder="Enter your question content here. Use $x^2$ for inline math or $$x^2$$ for display math..."
                  />
                </TabsContent>
                
                <TabsContent value="preview">
                  <Card>
                    <CardContent className="p-4">
                      {formData.content ? (
                        <MathRenderer content={formData.content} />
                      ) : (
                        <div className="text-gray-400 text-center">
                          No content to preview
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Explanation (Optional)</CardTitle>
              <CardDescription>Add explanation or solution hints</CardDescription>
            </CardHeader>
            <CardContent>
              <MathEditor
                value={formData.explanation}
                onChange={(value) => setFormData(prev => ({ ...prev, explanation: value }))}
                placeholder="Enter explanation or solution hints..."
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Past Exam Mapping</CardTitle>
                <CardDescription>Reference to past exam (e.g., "JEE Main 2023 Shift 2 Q14")</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={formData.pastExamMapping}
                  onChange={(e) => setFormData(prev => ({ ...prev, pastExamMapping: e.target.value }))}
                  placeholder="e.g., JEE Main 2023 Shift 2 Q14"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Comma-separated tags for better organization</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g., calculus, integration, by-parts"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          {showOptions() ? (
            <Card>
              <CardHeader>
                <CardTitle>Answer Options</CardTitle>
                <CardDescription>
                  {formData.type === QuestionType.MCQ_SINGLE ? 'Select one correct answer' : 
                   formData.type === QuestionType.MCQ_MULTI ? 'Select one or more correct answers' : 
                   'Match items from both columns'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {options.map((option, index) => (
                  <Card key={option.id}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Option {index + 1}</Label>
                          <div className="flex items-center gap-2">
                            {formData.type === QuestionType.MCQ_SINGLE && (
                              <Switch
                                checked={option.isCorrect}
                                onCheckedChange={(checked) => updateOption(option.id, 'isCorrect', checked)}
                              />
                            )}
                            {formData.type === QuestionType.MCQ_MULTI && (
                              <Switch
                                checked={option.isCorrect}
                                onCheckedChange={(checked) => updateOption(option.id, 'isCorrect', checked)}
                              />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(option.id)}
                              disabled={options.length <= 2}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        
                        <MathEditor
                          value={option.content}
                          onChange={(value) => updateOption(option.id, 'content', value)}
                          placeholder={`Enter option ${index + 1} content...`}
                        />
                        
                        <div>
                          <Label>Rationale (Optional)</Label>
                          <Textarea
                            value={option.rationale || ''}
                            onChange={(e) => updateOption(option.id, 'rationale', e.target.value)}
                            placeholder="Explain why this option is correct or incorrect..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addOption}
                  className="w-full"
                >
                  Add Option
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">
                  This question type doesn't require options. Students will provide their own answers.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Settings</CardTitle>
              <CardDescription>Configure additional settings for this question</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Partial Marking</Label>
                  <p className="text-sm text-gray-500">
                    Allow partial marks for partially correct answers
                  </p>
                </div>
                <Switch
                  checked={formData.partialMarking}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, partialMarking: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Shuffle Options</Label>
                  <p className="text-sm text-gray-500">
                    Randomize option order for each student
                  </p>
                </div>
                <Switch
                  checked={formData.shuffleOptions}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffleOptions: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (question ? 'Update Question' : 'Create Question')}
        </Button>
      </div>
    </form>
  )
}