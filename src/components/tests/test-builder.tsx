"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Target, 
  BookOpen, 
  Clock, 
  Users, 
  Brain,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Subject {
  id: string
  name: string
  chapters: Chapter[]
}

interface Chapter {
  id: string
  name: string
  topics: Topic[]
}

interface Topic {
  id: string
  name: string
}

interface Blueprint {
  name: string
  description?: string
  subjects: string[]
  chapters: string[]
  topics: string[]
  difficultyMix: number[]
  questionCount: number
  timePerSection?: number
  negativeMarking: {
    enabled: boolean
    value: number
  }
  shuffleQuestions: boolean
  shuffleOptions: boolean
  sections: 'auto' | 'manual'
  sectionConfig: Array<{
    name: string
    subjectFilter?: string[]
    questionCount: number
    duration?: number
  }>
}

interface TestBuilderProps {
  onSuccess: () => void
}

export function TestBuilder({ onSuccess }: TestBuilderProps) {
  const [blueprint, setBlueprint] = useState<Blueprint>({
    name: '',
    description: '',
    subjects: [],
    chapters: [],
    topics: [],
    difficultyMix: [1, 2, 3, 4, 5],
    questionCount: 50,
    timePerSection: 30,
    negativeMarking: {
      enabled: true,
      value: 0.25
    },
    shuffleQuestions: true,
    shuffleOptions: true,
    sections: 'auto',
    sectionConfig: []
  })

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [availableQuestions, setAvailableQuestions] = useState(0)
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('blueprint')

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    if (blueprint.subjects.length > 0 || blueprint.chapters.length > 0 || blueprint.topics.length > 0) {
      updateAvailableQuestions()
    }
  }, [blueprint.subjects, blueprint.chapters, blueprint.topics, blueprint.difficultyMix])

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

  const updateAvailableQuestions = async () => {
    try {
      const params = new URLSearchParams()
      blueprint.subjects.forEach(id => params.append('subjectId', id))
      blueprint.chapters.forEach(id => params.append('chapterId', id))
      blueprint.topics.forEach(id => params.append('topicId', id))
      blueprint.difficultyMix.forEach(d => params.append('difficulty', d.toString()))

      const response = await fetch(`/api/questions?${params}&limit=1`)
      const data = await response.json()
      setAvailableQuestions(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error updating available questions:', error)
    }
  }

  const generatePreview = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tests/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprint)
      })

      if (response.ok) {
        const data = await response.json()
        setPreview(data)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const createTest = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blueprint.name,
          description: blueprint.description,
          organizationId: 'default-org',
          mode: 'PRACTICE',
          duration: blueprint.timePerSection ? blueprint.timePerSection * (blueprint.sectionConfig.length || 1) : 60,
          shuffleQuestions: blueprint.shuffleQuestions,
          shuffleOptions: blueprint.shuffleOptions,
          negativeMarking: blueprint.negativeMarking,
          autoAssembly: true,
          blueprint: blueprint
        })
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to create test')
      }
    } catch (error) {
      console.error('Error creating test:', error)
      alert('Failed to create test')
    } finally {
      setLoading(false)
    }
  }

  const getSelectedSubjects = () => {
    return subjects.filter(s => blueprint.subjects.includes(s.id))
  }

  const getSelectedChapters = () => {
    const allChapters = subjects.flatMap(s => s.chapters)
    return allChapters.filter(c => blueprint.chapters.includes(c.id))
  }

  const getSelectedTopics = () => {
    const allTopics = subjects.flatMap(s => s.chapters).flatMap(c => c.topics)
    return allTopics.filter(t => blueprint.topics.includes(t.id))
  }

  const getDifficultyText = (level: number) => {
    const texts = {
      1: 'Very Easy',
      2: 'Easy', 
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard'
    }
    return texts[level as keyof typeof texts] || 'Unknown'
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="blueprint">Blueprint Designer</TabsTrigger>
          <TabsTrigger value="preview">Test Preview</TabsTrigger>
          <TabsTrigger value="settings">Advanced Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="blueprint" className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Test Blueprint</CardTitle>
              <CardDescription>Define the structure and requirements for your auto-generated test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testName">Test Name *</Label>
                <Input
                  id="testName"
                  value={blueprint.name}
                  onChange={(e) => setBlueprint(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter test name"
                />
              </div>

              <div>
                <Label htmlFor="testDescription">Description</Label>
                <Input
                  id="testDescription"
                  value={blueprint.description}
                  onChange={(e) => setBlueprint(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter test description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="questionCount">Total Questions *</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    value={blueprint.questionCount}
                    onChange={(e) => setBlueprint(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                    min="1"
                    max="200"
                  />
                </div>

                <div>
                  <Label htmlFor="timePerSection">Time per Section (minutes)</Label>
                  <Input
                    id="timePerSection"
                    type="number"
                    value={blueprint.timePerSection}
                    onChange={(e) => setBlueprint(prev => ({ ...prev, timePerSection: parseInt(e.target.value) }))}
                    min="1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Content Selection</CardTitle>
              <CardDescription>Choose subjects, chapters, and topics for question selection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subjects */}
              <div>
                <Label className="text-base font-medium">Subjects</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  {subjects.map(subject => (
                    <div key={subject.id} className="flex items-center space-x-2">
                      <Switch
                        checked={blueprint.subjects.includes(subject.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBlueprint(prev => ({ 
                              ...prev, 
                              subjects: [...prev.subjects, subject.id]
                            }))
                          } else {
                            setBlueprint(prev => ({ 
                              ...prev, 
                              subjects: prev.subjects.filter(id => id !== subject.id),
                              chapters: prev.chapters.filter(chapId => 
                                !subject.chapters.some(chap => chap.id === chapId)
                              ),
                              topics: prev.topics.filter(topicId => 
                                !subject.chapters.some(chap => 
                                  chap.topics.some(topic => topic.id === topicId)
                                )
                              )
                            }))
                          }
                        }}
                      />
                      <span className="text-sm">{subject.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chapters */}
              {getSelectedSubjects().length > 0 && (
                <div>
                  <Label className="text-base font-medium">Chapters</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {getSelectedSubjects().flatMap(subject => subject.chapters).map(chapter => (
                      <div key={chapter.id} className="flex items-center space-x-2">
                        <Switch
                          checked={blueprint.chapters.includes(chapter.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBlueprint(prev => ({ 
                                ...prev, 
                                chapters: [...prev.chapters, chapter.id]
                              }))
                            } else {
                              setBlueprint(prev => ({ 
                                ...prev, 
                                chapters: prev.chapters.filter(id => id !== chapter.id),
                                topics: prev.topics.filter(topicId => 
                                  !chapter.topics.some(topic => topic.id === topicId)
                                )
                              }))
                            }
                          }}
                        />
                        <span className="text-sm">{chapter.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              {getSelectedChapters().length > 0 && (
                <div>
                  <Label className="text-base font-medium">Topics</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {getSelectedChapters().flatMap(chapter => chapter.topics).map(topic => (
                      <div key={topic.id} className="flex items-center space-x-2">
                        <Switch
                          checked={blueprint.topics.includes(topic.id)}
                          onCheckedChange={(checked) => {
                            setBlueprint(prev => ({ 
                              ...prev, 
                              topics: checked 
                                ? [...prev.topics, topic.id]
                                : prev.topics.filter(id => id !== topic.id)
                            }))
                          }}
                        />
                        <span className="text-sm">{topic.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Questions */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Available Questions</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {availableQuestions}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Mix */}
          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Set the difficulty mix for your test questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(level => (
                  <div key={level} className="flex items-center space-x-4">
                    <div className="w-24">
                      <Label className="text-sm">{getDifficultyText(level)}</Label>
                    </div>
                    <div className="flex-1">
                      <Switch
                        checked={blueprint.difficultyMix.includes(level)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBlueprint(prev => ({ 
                              ...prev, 
                              difficultyMix: [...prev.difficultyMix, level].sort()
                            }))
                          } else {
                            setBlueprint(prev => ({ 
                              ...prev, 
                              difficultyMix: prev.difficultyMix.filter(l => l !== level)
                            }))
                          }
                        }}
                      />
                    </div>
                    {blueprint.difficultyMix.includes(level) && (
                      <Badge variant="outline">
                        {Math.round(100 / blueprint.difficultyMix.length)}%
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Test Preview</CardTitle>
                  <CardDescription>Preview how your test will be generated</CardDescription>
                </div>
                <Button onClick={generatePreview} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Generate Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{preview.totalQuestions}</div>
                      <div className="text-sm text-gray-600">Total Questions</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{preview.totalMarks}</div>
                      <div className="text-sm text-gray-600">Total Marks</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{preview.duration}</div>
                      <div className="text-sm text-gray-600">Duration (min)</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{preview.sections?.length || 1}</div>
                      <div className="text-sm text-gray-600">Sections</div>
                    </div>
                  </div>

                  {preview.sections && preview.sections.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Sections</h4>
                      <div className="space-y-2">
                        {preview.sections.map((section: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{section.name}</div>
                              <div className="text-sm text-gray-600">{section.questionCount} questions</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{section.marks} marks</div>
                              <div className="text-sm text-gray-600">{section.duration} min</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-3">Difficulty Distribution</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries.preview.difficultyDistribution || {}.map(([level, count]: [string, any]) => (
                        <div key={level} className="text-center p-2 border rounded-lg">
                          <div className="font-medium">{getDifficultyText(parseInt(level))}</div>
                          <div className="text-sm text-gray-600">{count} questions</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Generate a preview to see how your test will be structured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure advanced test options</CardDescription>
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
                    checked={blueprint.shuffleQuestions}
                    onCheckedChange={(checked) => setBlueprint(prev => ({ ...prev, shuffleQuestions: checked }))}
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
                    checked={blueprint.shuffleOptions}
                    onCheckedChange={(checked) => setBlueprint(prev => ({ ...prev, shuffleOptions: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Negative Marking</Label>
                    <p className="text-sm text-gray-500">
                      Deduct marks for wrong answers
                    </p>
                  </div>
                  <Switch
                    checked={blueprint.negativeMarking.enabled}
                    onCheckedChange={(checked) => setBlueprint(prev => ({ 
                      ...prev, 
                      negativeMarking: { ...prev.negativeMarking, enabled: checked }
                    }))}
                  />
                </div>

                {blueprint.negativeMarking.enabled && (
                  <div className="ml-6">
                    <Label className="text-sm">Deduction Amount</Label>
                    <Select 
                      value={blueprint.negativeMarking.value.toString()} 
                      onValueChange={(value) => setBlueprint(prev => ({ 
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

              <Separator />

              <div>
                <Label>Section Organization</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={blueprint.sections === 'auto'}
                      onCheckedChange={(checked) => setBlueprint(prev => ({ 
                        ...prev, 
                        sections: checked ? 'auto' : 'manual'
                      }))}
                    />
                    <span className="text-sm">Auto-generate sections by subject</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={blueprint.sections === 'manual'}
                      onCheckedChange={(checked) => setBlueprint(prev => ({ 
                        ...prev, 
                        sections: checked ? 'manual' : 'auto'
                      }))}
                    />
                    <span className="text-sm">Manual section configuration</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {availableQuestions >= blueprint.questionCount ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Sufficient questions available</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Only {availableQuestions} questions available</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button 
            onClick={createTest} 
            disabled={loading || !blueprint.name || availableQuestions < blueprint.questionCount}
          >
            {loading ? 'Creating Test...' : 'Create Test'}
          </Button>
        </div>
      </div>
    </div>
  )
}