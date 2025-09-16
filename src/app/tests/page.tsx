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
  Clock, 
  Users, 
  BookOpen,
  Edit,
  Trash2,
  Eye,
  Play,
  Copy,
  Settings,
  Target,
  Brain,
  Calendar
} from 'lucide-react'
import { TestForm } from '@/components/tests/test-form'
import { TestBuilder } from '@/components/tests/test-builder'
import { TestView } from '@/components/tests/test-view'
import { TestMode, TestStatus } from '@prisma/client'

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
  passing_marks?: number
  total_marks?: number
  instructions?: string
  organization: { id: string; name: string; slug: string }
  created_by: { id: string; name: string; email: string }
  template?: { id: string; name: string; type: string }
  sections: Array<{
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
      question: {
        id: string
        title?: string
        content: string
        type: string
        difficulty: number
        marks: number
        subject: { name: string }
        chapter?: { name: string }
      }
    }>
  }>
  _count: {
    attempts: number
    questions: number
    assignments: number
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

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMode, setSelectedMode] = useState<TestMode | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<TestStatus | ''>('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isBuilderDialogOpen, setIsBuilderDialogOpen] = useState(false)
  const [viewingTest, setViewingTest] = useState<Test | null>(null)
  const [editingTest, setEditingTest] = useState<Test | null>(null)

  const fetchTests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedMode) params.append('mode', selectedMode)
      if (selectedStatus) params.append('status', selectedStatus)

      const response = await fetch(`/api/tests?${params}`)
      const data = await response.json()

      if (response.ok) {
        setTests(data.tests)
        setPagination(data.pagination)
      } else {
        console.error('Failed to fetch tests:', data.error)
      }
    } catch (error) {
      console.error('Error fetching tests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTests()
  }, [pagination.page, pagination.limit])

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchTests()
  }

  const handleTestCreated = () => {
    setIsCreateDialogOpen(false)
    fetchTests()
  }

  const handleTestBuilt = () => {
    setIsBuilderDialogOpen(false)
    fetchTests()
  }

  const handleTestUpdated = () => {
    setEditingTest(null)
    fetchTests()
  }

  const handleTestDeleted = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchTests()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete test')
      }
    } catch (error) {
      console.error('Error deleting test:', error)
      alert('Failed to delete test')
    }
  }

  const handleTestAction = async (testId: string, action: string) => {
    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        fetchTests()
      } else {
        const data = await response.json()
        alert(data.error || `Failed to ${action} test`)
      }
    } catch (error) {
      console.error(`Error ${action}ing test:`, error)
      alert(`Failed to ${action} test`)
    }
  }

  const duplicateTest = async (test: Test) => {
    try {
      const response = await fetch(`/api/tests/${test.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' })
      })

      if (response.ok) {
        fetchTests()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to duplicate test')
      }
    } catch (error) {
      console.error('Error duplicating test:', error)
      alert('Failed to duplicate test')
    }
  }

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Test Builder</h1>
          <p className="text-gray-600 mt-2">Create and manage your assessments</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBuilderDialogOpen} onOpenChange={setIsBuilderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Auto-Builder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Auto-Test Builder</DialogTitle>
                <DialogDescription>
                  Create tests automatically from question bank using intelligent blueprints
                </DialogDescription>
              </DialogHeader>
              <TestBuilder onSuccess={handleTestBuilt} />
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Test</DialogTitle>
                <DialogDescription>
                  Set up a new assessment with manual question selection
                </DialogDescription>
              </DialogHeader>
              <TestForm onSuccess={handleTestCreated} />
            </DialogContent>
          </Dialog>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as TestMode | '')}>
              <SelectTrigger>
                <SelectValue placeholder="Test Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Modes</SelectItem>
                {Object.values(TestMode).map(mode => (
                  <SelectItem key={mode} value={mode}>{mode.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as TestStatus | '')}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {Object.values(TestStatus).map(status => (
                  <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch}>Apply Filters</Button>
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setSelectedMode('')
              setSelectedStatus('')
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading tests...</div>
        ) : tests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tests found</h3>
              <p className="text-gray-600 mb-4">Create your first test or use the auto-builder to get started</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test
                </Button>
                <Button variant="outline" onClick={() => setIsBuilderDialogOpen(true)}>
                  <Target className="h-4 w-4 mr-2" />
                  Auto-Builder
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {tests.map((test) => (
              <Card key={test.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
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
                      
                      <h3 className="text-lg font-semibold mb-2">{test.title}</h3>
                      
                      {test.description && (
                        <p className="text-gray-600 mb-3">{test.description}</p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{test.duration} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          <span>{test._count.questions} questions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          <span>{test.total_marks || 0} marks</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{test._count.attempts} attempts</span>
                        </div>
                      </div>

                      {test.sections.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Sections:</div>
                          <div className="flex flex-wrap gap-1">
                            {test.sections.map((section, index) => (
                              <Badge key={section.id} variant="secondary" className="text-xs">
                                {section.name} ({section.questions?.length || 0})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingTest(test)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTest(test)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateTest(test)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {test.status === TestStatus.DRAFT && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestAction(test.id, 'publish')}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestDeleted(test.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>Created by {test.created_by.name}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(test.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test.shuffle_questions && <Badge variant="outline">Shuffle Q</Badge>}
                      {test.shuffle_options && <Badge variant="outline">Shuffle Opt</Badge>}
                      {test.show_results && <Badge variant="outline">Show Results</Badge>}
                      {test.show_solutions && <Badge variant="outline">Show Solutions</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tests
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

      {/* View Test Dialog */}
      <Dialog open={!!viewingTest} onOpenChange={() => setViewingTest(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Test</DialogTitle>
          </DialogHeader>
          {viewingTest && <TestView test={viewingTest} />}
        </DialogContent>
      </Dialog>

      {/* Edit Test Dialog */}
      <Dialog open={!!editingTest} onOpenChange={() => setEditingTest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Test</DialogTitle>
            <DialogDescription>
              Update test details and settings
            </DialogDescription>
          </DialogHeader>
          {editingTest && (
            <TestForm 
              test={editingTest} 
              onSuccess={handleTestUpdated} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}