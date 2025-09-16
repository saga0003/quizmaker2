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
import { TestMode, TestStatus } from '@prisma/client'

interface Section {
  id: string
  name: string
  description?: string
  order: number
  duration?: number
  marks?: number
  instructions?: string
  settings?: any
  questions: Array<{
    id: string
    questionId: string
    order: number
    marks: number
    negativeMarks: number
    settings?: any
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
  instructions?: string
  settings?: any
  organization_id: string
  created_by_id: string
  sections: Section[]
}

interface TestFormProps {
  test?: Test
  onSuccess: () => void
}

export function TestForm({ test, onSuccess }: TestFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    mode: TestMode.PRACTICE,
    duration: 60,
    startTime: '',
    endTime: '',
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResults: true,
    showSolutions: false,
    allowReview: true,
    negativeMarking: { enabled: false, value: 0.25 },
    passingMarks: 0,
    instructions: '',
    settings: {}
  })

  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (test) {
      setFormData({
        title: test.title,
        description: test.description || '',
        code: test.code || '',
        mode: test.mode,
        status: test.status,
        duration: test.duration,
        startTime: test.start_time ? new Date(test.start_time).toISOString().slice(0, 16) : '',
        endTime: test.end_time ? new Date(test.end_time).toISOString().slice(0, 16) : '',
        maxAttempts: test.max_attempts,
        shuffleQuestions: test.shuffle_questions,
        shuffleOptions: test.shuffle_options,
        showResults: test.show_results,
        showSolutions: test.show_solutions,
        allowReview: test.allow_review,
        negativeMarking: test.negative_marking || { enabled: false, value: 0.25 },
        passingMarks: test.passing_marks || 0,
        instructions: test.instructions || '',
        settings: test.settings || {}
      })
      setSections(test.sections)
    } else {
      // Add a default section for new tests
      setSections([{
        id: Date.now().toString(),
        name: 'Section 1',
        description: '',
        order: 0,
        duration: undefined,
        marks: undefined,
        instructions: '',
        settings: {},
        questions: []
      }])
    }
  }, [test])

  const addSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      name: `Section ${sections.length + 1}`,
      description: '',
      order: sections.length,
      duration: undefined,
      marks: undefined,
      instructions: '',
      settings: {},
      questions: []
    }
    setSections([...sections, newSection])
  }

  const updateSection = (id: string, field: keyof Section, value: any) => {
    setSections(sections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ))
  }

  const removeSection = (id: string) => {
    if (sections.length <= 1) return
    setSections(sections.filter(section => section.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = test ? `/api/tests/${test.id}` : '/api/tests'
      const method = test ? 'PUT' : 'POST'

      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        code: formData.code || undefined,
        mode: formData.mode,
        duration: formData.duration,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        maxAttempts: formData.maxAttempts,
        shuffleQuestions: formData.shuffleQuestions,
        shuffleOptions: formData.shuffleOptions,
        showResults: formData.showResults,
        showSolutions: formData.showSolutions,
        allowReview: formData.allowReview,
        negativeMarking: formData.negativeMarking,
        passingMarks: formData.passingMarks || undefined,
        instructions: formData.instructions || undefined,
        settings: formData.settings,
        organizationId: test?.organization_id || 'default-org',
        sections: sections.map(section => ({
          name: section.name,
          description: section.description || undefined,
          order: section.order,
          duration: section.duration,
          marks: section.marks,
          instructions: section.instructions || undefined,
          settings: section.settings || {},
          questions: section.questions.map(q => ({
            questionId: q.questionId,
            order: q.order,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            settings: q.settings || {}
          }))
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
        alert(data.error || 'Failed to save test')
      }
    } catch (error) {
      console.error('Error saving test:', error)
      alert('Failed to save test')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set the basic properties of your test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Test Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter test title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter test description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Test Code (Optional)</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., MATH101_QUIZ1"
                  />
                </div>

                <div>
                  <Label htmlFor="mode">Test Mode</Label>
                  <Select value={formData.mode} onValueChange={(value) => setFormData(prev => ({ ...prev, mode: value as TestMode }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TestMode).map(mode => (
                        <SelectItem key={mode} value={mode}>
                          {mode.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    min="1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="maxAttempts">Max Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    value={formData.maxAttempts}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) }))}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="passingMarks">Passing Marks (%)</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    value={formData.passingMarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, passingMarks: parseInt(e.target.value) }))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time (Optional)</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="endTime">End Time (Optional)</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Test Sections</CardTitle>
                  <CardDescription>Organize your test into sections</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={addSection}>
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sections.map((section, index) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{section.name}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSection(section.id)}
                          disabled={sections.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Section Name</Label>
                          <Input
                            value={section.name}
                            onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                            placeholder="Enter section name"
                          />
                        </div>
                        <div>
                          <Label>Duration (minutes, optional)</Label>
                          <Input
                            type="number"
                            value={section.duration || ''}
                            onChange={(e) => updateSection(section.id, 'duration', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Leave empty for test duration"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={section.description || ''}
                          onChange={(e) => updateSection(section.id, 'description', e.target.value)}
                          placeholder="Enter section description"
                          rows={2}
                        />
                      </div>

                      <div>
                        <Label>Instructions</Label>
                        <Textarea
                          value={section.instructions || ''}
                          onChange={(e) => updateSection(section.id, 'instructions', e.target.value)}
                          placeholder="Enter section-specific instructions"
                          rows={2}
                        />
                      </div>

                      <div className="text-sm text-gray-500">
                        Questions will be added to this section in the test builder or manually
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Settings</CardTitle>
              <CardDescription>Configure test behavior and options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Shuffle Questions</Label>
                    <p className="text-sm text-gray-500">
                      Randomize question order for each student
                    </p>
                  </div>
                  <Switch
                    checked={formData.shuffleQuestions}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffleQuestions: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Shuffle Options</Label>
                    <p className="text-sm text-gray-500">
                      Randomize option order for multiple choice questions
                    </p>
                  </div>
                  <Switch
                    checked={formData.shuffleOptions}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffleOptions: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Results</Label>
                    <p className="text-sm text-gray-500">
                      Allow students to view their results after completion
                    </p>
                  </div>
                  <Switch
                    checked={formData.showResults}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showResults: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Solutions</Label>
                    <p className="text-sm text-gray-500">
                      Show detailed solutions and explanations
                    </p>
                  </div>
                  <Switch
                    checked={formData.showSolutions}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showSolutions: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Review</Label>
                    <p className="text-sm text-gray-500">
                      Allow students to review and change answers
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowReview}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowReview: checked }))}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <Label>Negative Marking</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.negativeMarking.enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ 
                        ...prev, 
                        negativeMarking: { ...prev.negativeMarking, enabled: checked }
                      }))}
                    />
                    <span className="text-sm">Enable negative marking</span>
                  </div>
                  {formData.negativeMarking.enabled && (
                    <div className="ml-6">
                      <Label className="text-sm">Deduct marks for wrong answers</Label>
                      <Select 
                        value={formData.negativeMarking.value?.toString() || '0.25'} 
                        onValueChange={(value) => setFormData(prev => ({ 
                          ...prev, 
                          negativeMarking: { ...prev.negativeMarking, value: parseFloat(value) }
                        }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.25">25%</SelectItem>
                          <SelectItem value="0.33">33%</SelectItem>
                          <SelectItem value="0.5">50%</SelectItem>
                          <SelectItem value="1">100%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Instructions</CardTitle>
              <CardDescription>Provide instructions for students taking the test</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Enter test instructions for students..."
                rows={10}
                className="resize-none"
              />
              <div className="mt-2 text-sm text-gray-500">
                These instructions will be shown to students before they start the test.
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
          {loading ? 'Saving...' : (test ? 'Update Test' : 'Create Test')}
        </Button>
      </div>
    </form>
  )
}