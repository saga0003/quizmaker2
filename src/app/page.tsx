"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, Trophy, BarChart3, Shield, Clock, Calculator, FileText } from "lucide-react"
import Link from "next/link"

export default function Home() {
  const [selectedRole, setSelectedRole] = useState("student")

  const features = [
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Rich Question Bank",
      description: "Support for multiple question types including MCQ, descriptive, and mathematical equations with LaTeX"
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Multi-Tenant Platform",
      description: "White-label solution for institutions with custom domains and branding"
    },
    {
      icon: <Trophy className="h-8 w-8" />,
      title: "Auto-Test Generation",
      description: "Intelligent test assembly from tagged question bank with customizable blueprints"
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Advanced Analytics",
      description: "Detailed performance insights for students and teachers with heatmaps and trends"
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Proctoring & Security",
      description: "AI-powered proctoring with anti-cheat measures and secure exam environment"
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Real-time Monitoring",
      description: "Live proctoring with tab-switch detection, webcam monitoring, and activity logging"
    }
  ]

  const questionTypes = [
    { name: "MCQ Single", icon: <Calculator className="h-5 w-5" />, description: "Single correct answer" },
    { name: "MCQ Multi", icon: <FileText className="h-5 w-5" />, description: "Multiple correct answers" },
    { name: "Integer", icon: <Calculator className="h-5 w-5" />, description: "Exact numerical answer" },
    { name: "Numeric Range", icon: <Calculator className="h-5 w-5" />, description: "Answer within tolerance" },
    { name: "Assertion-Reason", icon: <FileText className="h-5 w-5" />, description: "Statement and reasoning" },
    { name: "Matrix Match", icon: <FileText className="h-5 w-5" />, description: "Column matching" },
    { name: "Fill in Blank", icon: <FileText className="h-5 w-5" />, description: "Complete the text" },
    { name: "Descriptive", icon: <FileText className="h-5 w-5" />, description: "Long answer with file upload" }
  ]

  const userRoles = [
    {
      id: "student",
      title: "Student",
      description: "Take tests, view results, and track progress",
      features: ["Take proctored exams", "View detailed analytics", "Practice with adaptive tests", "Track weak areas"]
    },
    {
      id: "teacher",
      title: "Teacher",
      description: "Create tests, monitor students, and analyze performance",
      features: ["Create custom tests", "Monitor student progress", "Analyze test performance", "Manage question bank"]
    },
    {
      id: "admin",
      title: "Administrator",
      description: "Manage organization, users, and system settings",
      features: ["Manage organizations", "User management", "System configuration", "Analytics and reporting"]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative w-10 h-10">
              <img
                src="/logo.svg"
                alt="QuizPlatform Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">QuizPlatform</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/questions">
              <Button variant="ghost">Questions</Button>
            </Link>
            <Link href="/tests">
              <Button variant="ghost">Tests</Button>
            </Link>
            <Button variant="ghost">Features</Button>
            <Button variant="ghost">Pricing</Button>
            <Button variant="ghost">Documentation</Button>
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/login">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          Universal Quiz & Exam Platform
        </Badge>
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
          Comprehensive Assessment Platform for Modern Education
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
          Build, deliver, and analyze assessments with advanced features including mathematical equations support, 
          AI-powered proctoring, and detailed analytics for JEE, NEET, Olympiads, and academic institutions.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-lg px-8">
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8">
            View Demo
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          Powerful Features for Every Need
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="text-blue-600 dark:text-blue-400 mb-2">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Question Types Section */}
      <section className="container mx-auto px-4 py-16 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          Support for All Question Types
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {questionTypes.map((type, index) => (
            <Card key={index} className="text-center hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="text-blue-600 dark:text-blue-400 mb-3 flex justify-center">
                  {type.icon}
                </div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{type.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{type.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* User Roles Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          Designed for Every Role
        </h2>
        <Tabs value={selectedRole} onValueChange={setSelectedRole} className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            {userRoles.map((role) => (
              <TabsTrigger key={role.id} value={role.id} className="text-base">
                {role.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {userRoles.map((role) => (
            <TabsContent key={role.id} value={role.id} className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{role.title}</CardTitle>
                  <CardDescription className="text-lg">
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {role.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-6">
                    Get Started as {role.title}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">Ready to Get Started?</CardTitle>
            <CardDescription className="text-lg">
              Join thousands of educators and students using QuizPlatform for assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Schedule Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2024 QuizPlatform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}